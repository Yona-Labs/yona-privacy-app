use anchor_lang::prelude::*;

declare_id!("6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx");
declare_program!(jupiter_aggregator);


pub mod merkle_tree;
pub mod utils;
pub mod groth16;
pub mod errors;
pub mod state;
pub mod types;
pub mod instructions;

pub use state::*;
pub use types::*;
pub use instructions::*;
pub use errors::ErrorCode;


pub const ADMIN_PUBKEY: Option<Pubkey> = Some(pubkey!("DJZCAiVf4WTB84iziDjXXpW32EJinEwbyary79NMjWz7"));

#[program]
pub mod zert {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn update_deposit_limit(ctx: Context<UpdateDepositLimit>, new_limit: u64) -> Result<()> {
        instructions::update_deposit_limit::handler(ctx, new_limit)
    }

    pub fn update_global_config(
        ctx: Context<UpdateGlobalConfig>, 
        deposit_fee_rate: Option<u16>,
        withdrawal_fee_rate: Option<u16>,
        fee_error_margin: Option<u16>
    ) -> Result<()> {
        instructions::update_global_config::handler(
            ctx, 
            deposit_fee_rate, 
            withdrawal_fee_rate, 
            fee_error_margin
        )
    }

    pub fn deposit(
        ctx: Context<Transact>, 
        proof: Proof, 
        ext_data_minified: ExtDataMinified, 
        encrypted_output: Vec<u8>, 
    ) -> Result<()> {
        instructions::deposit::handler(
            ctx, 
            proof, 
            ext_data_minified, 
            encrypted_output, 
        )
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        proof: Proof,
        ext_data_minified: ExtDataMinified,
        encrypted_output: Vec<u8>,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, proof, ext_data_minified, encrypted_output)    
    }

    pub fn swap(
        ctx: Context<Swap>,
        proof: Proof,
        ext_data_minified: SwapExtDataMinified,
        encrypted_output: Vec<u8>,
        jupiter_swap_data: Vec<u8>, 
    ) -> Result<()> {
        instructions::swap::handler(ctx, proof, ext_data_minified, encrypted_output, jupiter_swap_data)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<MerkleTreeAccount>(),
        seeds = [b"merkle_tree"],
        bump
    )]
    pub tree_account: AccountLoader<'info, MerkleTreeAccount>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<TreeTokenAccount>(),
        seeds = [b"tree_token"],
        bump
    )]
    pub tree_token_account: Account<'info, TreeTokenAccount>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<GlobalConfig>(),
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateDepositLimit<'info> {
    #[account(
        mut,
        seeds = [b"merkle_tree"],
        bump = tree_account.load()?.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub tree_account: AccountLoader<'info, MerkleTreeAccount>,
    
    /// The authority account that can update the deposit limit
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateGlobalConfig<'info> {
    #[account(
        mut,
        seeds = [b"global_config"],
        bump = global_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    /// The authority account that can update the global config
    pub authority: Signer<'info>,
}
