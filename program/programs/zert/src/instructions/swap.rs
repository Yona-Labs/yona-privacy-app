use anchor_lang::prelude::*;
use ark_ff::PrimeField;
use ark_bn254::Fr;
use light_hasher::Poseidon;
use anchor_spl::token_interface::{Mint, TokenAccount};
use anchor_spl::token::{transfer, Token, Transfer};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::instruction::Instruction;

use crate::merkle_tree::MerkleTree;
use crate::state::{MerkleTreeAccount, GlobalConfig, NullifierAccount};
use crate::types::{Proof, SwapExtData, SwapExtDataMinified, CommitmentData};
use crate::ErrorCode;
use crate::utils::{verify_proof, VERIFYING_KEY};
use crate::utils;


#[derive(Accounts)]
#[instruction(proof: Proof, ext_data_minified: SwapExtDataMinified, encrypted_output: Vec<u8>, jupiter_swap_data: Vec<u8>)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump = tree_account.load()?.bump
    )]
    pub tree_account: AccountLoader<'info, MerkleTreeAccount>,
    
    /// Nullifier account to mark the first input as spent
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<NullifierAccount>(),
        seeds = [b"nullifier", proof.input_nullifiers[0].as_ref()],
        bump
    )]
    pub nullifier0: Box<Account<'info, NullifierAccount>>,
    
    /// Nullifier account to mark the second input as spent
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
    pub output_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut,
        associated_token::mint = input_mint,  
        associated_token::authority = global_config,
    )]
    pub reserve_token_account_input: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut,
        associated_token::mint = output_mint,  
        associated_token::authority = global_config,
    )]
    pub reserve_token_account_output: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: user should be able to send fees to any types of accounts
    pub fee_recipient_account: UncheckedAccount<'info>,


    /// Jupiter aggregator program
    /// CHECK: Jupiter program ID
    pub jupiter_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}



/**
 * Swap tokens from one mint to another using Jupiter aggregator.
 * 
 * User burns UTXO with mintA and creates UTXO with mintB.
 * extAmount should be 0 for pure swaps (no deposit/withdrawal).
 * 
 * Reentrant attacks are not possible, because nullifier creation is checked by anchor first.
 */
pub fn handler(
    ctx: Context<Swap>, 
    proof: Proof, 
    ext_data_minified: SwapExtDataMinified, 
    encrypted_output: Vec<u8>, 
    jupiter_swap_data: Vec<u8>,   
) -> Result<()> {

    msg!("swap: extAmount={:?}", ext_data_minified.ext_amount);
    msg!("jupiter_swap_data provided: {:?}", jupiter_swap_data);
    
    let tree_account = &mut ctx.accounts.tree_account.load_mut()?;
    let global_config = &ctx.accounts.global_config;

    // Reconstruct full SwapExtData from minified version and context accounts
    let ext_data = SwapExtData::from_minified(
        &ctx.accounts.fee_recipient_account.key(),
        ext_data_minified,
    );

    // Check if proof.root is in the tree_account's proof history
    require!(
        MerkleTree::is_known_root(&tree_account, proof.root),
        ErrorCode::UnknownRoot
    );


    // Check if the ext_data hashes to the same ext_data in the proof
    let calculated_ext_data_hash = utils::calculate_swap_ext_data_hash(
        ext_data.ext_amount,
        ext_data.ext_min_amount_out,
        &encrypted_output,
        ext_data.fee,
        ext_data.fee_recipient,
        ctx.accounts.input_mint.key(),
        ctx.accounts.output_mint.key(),
    )?;
    require!(
        Fr::from_le_bytes_mod_order(&calculated_ext_data_hash) == Fr::from_be_bytes_mod_order(&proof.ext_data_hash),
        ErrorCode::ExtDataHashMismatch
    );

    // For swaps, extAmount should typically be 0 (no net deposit or withdrawal)
    require!(
        utils::check_public_amount(ext_data.ext_amount, ext_data.fee, proof.public_amount0),
        ErrorCode::InvalidPublicAmountData
    );

    let ext_amount = ext_data.ext_amount;
    let ext_min_amount_out = ext_data.ext_min_amount_out;
    let fee = ext_data.fee;

    // Validate fee calculation
    // utils::validate_fee( TODO
    //     ext_amount,
    //     fee,
    //     global_config.deposit_fee_rate,
    //     global_config.withdrawal_fee_rate,
    //     global_config.fee_error_margin,
    // )?;

    // Verify the proof with both mint addresses
    require!(
        verify_proof(
            proof.clone(), 
            VERIFYING_KEY, 
            ctx.accounts.input_mint.key(), 
            ctx.accounts.output_mint.key()
        ), 
        ErrorCode::InvalidProof
    );

    // Calculate swap amounts from public amounts
    // publicAmount0 is the net change in input mint (negative for swap out)
    // publicAmount1 is the net change in output mint (positive for swap in)
    
    // Convert public amounts from field elements to i64
    let public_amount0_bytes = proof.public_amount0;
    let public_amount1_bytes = proof.public_amount1;
    
    // Parse as field elements and convert to signed amounts
    let public_amount0_fr = Fr::from_be_bytes_mod_order(&public_amount0_bytes);
    let public_amount1_fr = Fr::from_be_bytes_mod_order(&public_amount1_bytes);

    
    // If Jupiter swap data is provided, execute Jupiter CPI
    if jupiter_swap_data.len() > 0 {

        // Build instruction for Jupiter CPI
        let mut account_metas = Vec::new();
        
        // Add remaining accounts (these are the accounts needed by Jupiter)
        for account in ctx.remaining_accounts.iter() {
            let is_signer = if *account.key == ctx.accounts.global_config.key() {
                true
            } else {
                account.is_signer
            };
            account_metas.push(anchor_lang::solana_program::instruction::AccountMeta {
                pubkey: *account.key,
                is_signer,
                is_writable: account.is_writable,
            });
        }
        
        msg!("Account metas count: {}", account_metas.len());
        
        // Create Jupiter instruction
        let jupiter_instruction = Instruction {
            program_id: ctx.accounts.jupiter_program.key(),
            accounts: account_metas,
            data: jupiter_swap_data,
        };
        
        // Execute Jupiter CPI
        let account_infos: Vec<AccountInfo> = ctx.remaining_accounts.to_vec();
        let global_config_seeds = &[
            b"global_config".as_ref(),
            &[global_config.bump],
        ];
        let signer_seeds = &[&global_config_seeds[..]];

        invoke_signed(
            &jupiter_instruction,
            &account_infos,
            signer_seeds,
        )?;
        
        msg!("Jupiter swap executed successfully");
    } else {
        msg!("No Jupiter swap data provided, skipping Jupiter CPI");
    }

    let next_index_to_insert = tree_account.next_index;
    MerkleTree::append::<Poseidon>(proof.output_commitments[0], tree_account)?;
    MerkleTree::append::<Poseidon>(proof.output_commitments[1], tree_account)?;

    let second_index = next_index_to_insert.checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    emit!(CommitmentData {
        index: next_index_to_insert,
        commitment0: proof.output_commitments[0],
        commitment1: proof.output_commitments[1],
        encrypted_output: encrypted_output.to_vec(),
    });

    
    Ok(())
}
