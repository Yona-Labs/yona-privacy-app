/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/zkcash.json`.
 */
export type Zert = {
  "address": "6Uok9UsjztPC9VJ3a8ZpawzKmgrD2VvMKQGb64FYjhnx",
  "metadata": {
    "name": "zert",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Anchor program for zert"
  },
  "instructions": [
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "treeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  107,
                  108,
                  101,
                  95,
                  116,
                  114,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "nullifier0",
          "docs": [
            "Nullifier account to mark the first input as spent.",
            "Using `init` without `init_if_needed` ensures that the transaction",
            "will automatically fail with a system program error if this nullifier",
            "has already been used (i.e., if the account already exists)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [0]"
              }
            ]
          }
        },
        {
          "name": "nullifier1",
          "docs": [
            "Nullifier account to mark the second input as spent.",
            "Using `init` without `init_if_needed` ensures that the transaction",
            "will automatically fail with a system program error if this nullifier",
            "has already been used (i.e., if the account already exists)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [1]"
              }
            ]
          }
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "inputMint"
        },
        {
          "name": "reserveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "globalConfig"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "inputMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeRecipientAccount"
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "inputMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "proof"
            }
          }
        },
        {
          "name": "extDataMinified",
          "type": {
            "defined": {
              "name": "extDataMinified"
            }
          }
        },
        {
          "name": "encryptedOutput",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "treeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  107,
                  108,
                  101,
                  95,
                  116,
                  114,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "treeTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "treeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  107,
                  108,
                  101,
                  95,
                  116,
                  114,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "nullifier0",
          "docs": [
            "Nullifier account to mark the first input as spent"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [0]"
              }
            ]
          }
        },
        {
          "name": "nullifier1",
          "docs": [
            "Nullifier account to mark the second input as spent"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [1]"
              }
            ]
          }
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "inputMint"
        },
        {
          "name": "outputMint"
        },
        {
          "name": "reserveTokenAccountInput",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "globalConfig"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "inputMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "reserveTokenAccountOutput",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "globalConfig"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "outputMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feeRecipientAccount"
        },
        {
          "name": "jupiterProgram",
          "docs": [
            "Jupiter aggregator program"
          ]
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "proof"
            }
          }
        },
        {
          "name": "extDataMinified",
          "type": {
            "defined": {
              "name": "swapExtDataMinified"
            }
          }
        },
        {
          "name": "encryptedOutput",
          "type": "bytes"
        },
        {
          "name": "jupiterSwapData",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "updateDepositLimit",
      "discriminator": [
        181,
        115,
        65,
        169,
        4,
        1,
        96,
        109
      ],
      "accounts": [
        {
          "name": "treeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  107,
                  108,
                  101,
                  95,
                  116,
                  114,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "The authority account that can update the deposit limit"
          ],
          "signer": true,
          "relations": [
            "treeAccount"
          ]
        }
      ],
      "args": [
        {
          "name": "newLimit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateGlobalConfig",
      "discriminator": [
        164,
        84,
        130,
        189,
        111,
        58,
        250,
        200
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "The authority account that can update the global config"
          ],
          "signer": true,
          "relations": [
            "globalConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "depositFeeRate",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "withdrawalFeeRate",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "feeErrorMargin",
          "type": {
            "option": "u16"
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "treeAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  107,
                  108,
                  101,
                  95,
                  116,
                  114,
                  101,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "nullifier0",
          "docs": [
            "Nullifier account to mark the first input as spent.",
            "Using `init` without `init_if_needed` ensures that the transaction",
            "will automatically fail with a system program error if this nullifier",
            "has already been used (i.e., if the account already exists)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [0]"
              }
            ]
          }
        },
        {
          "name": "nullifier1",
          "docs": [
            "Nullifier account to mark the second input as spent.",
            "Using `init` without `init_if_needed` ensures that the transaction",
            "will automatically fail with a system program error if this nullifier",
            "has already been used (i.e., if the account already exists)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "proof.input_nullifiers [1]"
              }
            ]
          }
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "inputMint"
        },
        {
          "name": "reserveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "globalConfig"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "inputMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "recipientTokenAccount",
          "writable": true
        },
        {
          "name": "feeRecipientAccount"
        },
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "proof",
          "type": {
            "defined": {
              "name": "proof"
            }
          }
        },
        {
          "name": "extDataMinified",
          "type": {
            "defined": {
              "name": "extDataMinified"
            }
          }
        },
        {
          "name": "encryptedOutput",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "merkleTreeAccount",
      "discriminator": [
        147,
        200,
        34,
        248,
        131,
        187,
        248,
        253
      ]
    },
    {
      "name": "nullifierAccount",
      "discriminator": [
        250,
        31,
        238,
        177,
        213,
        98,
        48,
        172
      ]
    },
    {
      "name": "treeTokenAccount",
      "discriminator": [
        153,
        63,
        39,
        198,
        74,
        80,
        37,
        204
      ]
    }
  ],
  "events": [
    {
      "name": "commitmentData",
      "discriminator": [
        13,
        110,
        215,
        127,
        244,
        62,
        234,
        34
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Not authorized to perform this action"
    },
    {
      "code": 6001,
      "name": "extDataHashMismatch",
      "msg": "External data hash does not match the one in the proof"
    },
    {
      "code": 6002,
      "name": "unknownRoot",
      "msg": "Root is not known in the tree"
    },
    {
      "code": 6003,
      "name": "invalidPublicAmountData",
      "msg": "Public amount is invalid"
    },
    {
      "code": 6004,
      "name": "insufficientFundsForWithdrawal",
      "msg": "Insufficient funds for withdrawal"
    },
    {
      "code": 6005,
      "name": "insufficientFundsForFee",
      "msg": "Insufficient funds for fee"
    },
    {
      "code": 6006,
      "name": "invalidProof",
      "msg": "Proof is invalid"
    },
    {
      "code": 6007,
      "name": "invalidFee",
      "msg": "Invalid fee: fee must be less than MAX_ALLOWED_VAL (2^248)."
    },
    {
      "code": 6008,
      "name": "invalidExtAmount",
      "msg": "Invalid ext amount: absolute ext_amount must be less than MAX_ALLOWED_VAL (2^248)."
    },
    {
      "code": 6009,
      "name": "publicAmountCalculationError",
      "msg": "Public amount calculation resulted in an overflow/underflow."
    },
    {
      "code": 6010,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow/underflow occurred"
    },
    {
      "code": 6011,
      "name": "depositLimitExceeded",
      "msg": "Deposit limit exceeded"
    },
    {
      "code": 6012,
      "name": "invalidFeeRate",
      "msg": "Invalid fee rate: must be between 0 and 10000 basis points"
    },
    {
      "code": 6013,
      "name": "invalidFeeRecipient",
      "msg": "Fee recipient does not match global configuration"
    },
    {
      "code": 6014,
      "name": "invalidFeeAmount",
      "msg": "Fee amount is below minimum required (must be at least (1 - fee_error_margin) * expected_fee)"
    },
    {
      "code": 6015,
      "name": "recipientMismatch",
      "msg": "Recipient account does not match the ExtData recipient"
    },
    {
      "code": 6016,
      "name": "merkleTreeFull",
      "msg": "Merkle tree is full: cannot add more leaves"
    },
    {
      "code": 6017,
      "name": "unsupportedMintAddress",
      "msg": "Unsupported mint address"
    },
    {
      "code": 6018,
      "name": "dualTokenNotSupported",
      "msg": "Dual-token transactions are not yet supported"
    }
  ],
  "types": [
    {
      "name": "commitmentData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "index",
            "type": "u64"
          },
          {
            "name": "commitment0",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "commitment1",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "encryptedOutput",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "extDataMinified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "extAmount",
            "type": "i64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "depositFeeRate",
            "type": "u16"
          },
          {
            "name": "withdrawalFeeRate",
            "type": "u16"
          },
          {
            "name": "feeErrorMargin",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "merkleTreeAccount",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "nextIndex",
            "type": "u64"
          },
          {
            "name": "subtrees",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                26
              ]
            }
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rootHistory",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                100
              ]
            }
          },
          {
            "name": "rootIndex",
            "type": "u64"
          },
          {
            "name": "maxDepositAmount",
            "type": "u64"
          },
          {
            "name": "height",
            "type": "u8"
          },
          {
            "name": "rootHistorySize",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "nullifierAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "This account's existence indicates that the nullifier has been used.",
              "No fields needed other than bump for PDA verification."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proof",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proofA",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "proofB",
            "type": {
              "array": [
                "u8",
                128
              ]
            }
          },
          {
            "name": "proofC",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "publicAmount0",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "publicAmount1",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "extDataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "inputNullifiers",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                2
              ]
            }
          },
          {
            "name": "outputCommitments",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "swapExtDataMinified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "extAmount",
            "type": "i64"
          },
          {
            "name": "extMinAmountOut",
            "type": "i64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "treeTokenAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
