use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::rent::Rent;
use ark_ff::PrimeField;
use ark_bn254::Fr;
use light_hasher::Poseidon;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::token::{transfer, Token, Transfer};

use crate::merkle_tree::MerkleTree;
use crate::state::{MerkleTreeAccount, TreeTokenAccount, GlobalConfig, NullifierAccount};
use crate::types::{Proof, ExtData, ExtDataMinified, CommitmentData};
use crate::ErrorCode;
use crate::utils::{verify_proof, VERIFYING_KEY};
use crate::utils;


#[derive(Accounts)]
#[instruction(proof: Proof, ext_data_minified: ExtDataMinified, encrypted_output: Vec<u8>)]
pub struct Transact<'info> {
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump = tree_account.load()?.bump
    )]
    pub tree_account: AccountLoader<'info, MerkleTreeAccount>,
    
    /// Nullifier account to mark the first input as spent.
    /// Using `init` without `init_if_needed` ensures that the transaction
    /// will automatically fail with a system program error if this nullifier
    /// has already been used (i.e., if the account already exists).
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<NullifierAccount>(),
        seeds = [b"nullifier", proof.input_nullifiers[0].as_ref()],
        bump
    )]
    pub nullifier0: Box<Account<'info, NullifierAccount>>,
    
    /// Nullifier account to mark the second input as spent.
    /// Using `init` without `init_if_needed` ensures that the transaction
    /// will automatically fail with a system program error if this nullifier
    /// has already been used (i.e., if the account already exists).
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<NullifierAccount>(),
        seeds = [b"nullifier", proof.input_nullifiers[1].as_ref()],
        bump
    )]
    pub nullifier1: Box<Account<'info, NullifierAccount>>,

    #[account(
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Box<Account<'info, GlobalConfig>>,
    
    pub input_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = input_mint,  
        associated_token::authority = global_config,
    )]
    pub reserve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,


    /// CHECK: user should be able to send fees to any types of accounts
    pub fee_recipient_account: UncheckedAccount<'info>,

    #[account(mut,
        associated_token::mint = input_mint,  
        associated_token::authority = user,
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}



pub fn handler(
    ctx: Context<Transact>, 
    proof: Proof, 
    ext_data_minified: ExtDataMinified, 
    encrypted_output: Vec<u8>,
) -> Result<()> {
    let tree_account = &mut ctx.accounts.tree_account.load_mut()?;
    let global_config = &ctx.accounts.global_config;

    // Reconstruct full ExtData from minified version and context accounts
    let ext_data = ExtData::from_minified(
        &ctx.accounts.reserve_token_account.key(),
        &ctx.accounts.fee_recipient_account.key(),
        ext_data_minified,
    );

    // Check if proof.root is in the tree_account's proof history
    require!(
        MerkleTree::is_known_root(&tree_account, proof.root),
        ErrorCode::UnknownRoot
    );
    // Check if the ext_data hashes to the same ext_data in the proof
    let calculated_ext_data_hash = utils::calculate_complete_ext_data_hash(
        ext_data.recipient,
        ext_data.ext_amount,
        &encrypted_output,
        ext_data.fee,
        ext_data.fee_recipient,
        ctx.accounts.input_mint.key(),
        ctx.accounts.input_mint.key(),
    )?;
    
    require!(
        Fr::from_le_bytes_mod_order(&calculated_ext_data_hash) == Fr::from_be_bytes_mod_order(&proof.ext_data_hash),
        ErrorCode::ExtDataHashMismatch
    );

    // For single-token SOL transactions, only publicAmount0 is used
    // The circuit validates that both mint addresses match and balance equations hold
    require!(
        utils::check_public_amount(ext_data.ext_amount, ext_data.fee, proof.public_amount0),
        ErrorCode::InvalidPublicAmountData
    );
    require!(proof.public_amount1 == [0; 32], ErrorCode::InvalidPublicAmountData); // publicAmount1 must be zero in single-token SOL mode
    let ext_amount = ext_data.ext_amount;
    let fee = ext_data.fee;

    // Validate fee calculation using utility function
    utils::validate_fee(
        ext_amount,
        fee,
        global_config.deposit_fee_rate,
        global_config.withdrawal_fee_rate,
        global_config.fee_error_margin,
    )?;

    // Verify the proof
    require!(verify_proof(proof.clone(), VERIFYING_KEY, ctx.accounts.input_mint.key(), ctx.accounts.input_mint.key()), ErrorCode::InvalidProof);

    require!(ext_amount > 0, ErrorCode::InvalidExtAmount);
    let deposit_amount = ext_amount as u64;

    require!(
        deposit_amount <= tree_account.max_deposit_amount,
        ErrorCode::DepositLimitExceeded
    );
    
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.reserve_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    transfer(transfer_ctx, deposit_amount)?;
    
    if fee > 0 {
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.fee_recipient_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer(transfer_ctx, fee)?;
    }

    let next_index_to_insert = tree_account.next_index;
    MerkleTree::append::<Poseidon>(proof.output_commitments[0], tree_account)?;
    MerkleTree::append::<Poseidon>(proof.output_commitments[1], tree_account)?;

    emit!(CommitmentData {
        index: next_index_to_insert,
        commitment0: proof.output_commitments[0],
        commitment1: proof.output_commitments[1],
        encrypted_output: encrypted_output.to_vec(),
    });

    
    Ok(())
}

