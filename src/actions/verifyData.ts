import { type Action, composeContext, elizaLogger, generateObject, type HandlerCallback, type IAgentRuntime, type Memory, ModelClass, type State } from "@elizaos/core";
import { ATTPsSDK, type VerifyParams } from "attps-sdk-js";
import { verifyDataTemplate } from "../templates";
import { isVerifyParams, VerifyParamsSchema } from "../types";
import type { ContractTransactionResponse } from "ethers";

export const verifyData: Action = {
  name: "VERIFY",
  similes: [
    'VERIFY_DATA',
  ],
  description: "Verify data with ATTPs. User must provide data to verify.",
  validate: async (_runtime: IAgentRuntime, _message: Memory) => {
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    // Initialize or update state
    let currentState = state;
    if (!currentState) {
        currentState = (await runtime.composeState(message)) as State;
    } else {
        currentState = await runtime.updateRecentMessageState(currentState);
    }

    // Generate verify params
    let verifyParams: VerifyParams;
    try {
        const response = await generateObject({
            runtime,
            context: composeContext({
                state: currentState,
                template: verifyDataTemplate,
            }),
            modelClass: ModelClass.LARGE,
            schema: VerifyParamsSchema,
        });

        verifyParams = response.object as VerifyParams;
        elizaLogger.info('The verify params received:', verifyParams);
    }  catch (error: unknown) {
        if (error instanceof Error) {
            elizaLogger.error('Failed to generate verify params:', error.message);
        } else {
            elizaLogger.error('Failed to generate verify params:', String(error));
        }
        callback({
            text: 'Failed to generate verify params. Please provide valid input.',
        });
        return;
    }

    // Validate verify params
    if (!isVerifyParams(verifyParams)) {
        elizaLogger.error('Invalid verify params:', verifyParams);
        callback({
            text: 'Invalid verify params. Please provide valid input.',
        });
        return;
    }

    // Create SDK agent
    let agent: ATTPsSDK
    try {
        agent = new ATTPsSDK({
            proxyAddress: runtime.getSetting('ATTPS_PROXY_ADDRESS') ?? process.env.ATTPS_PROXY_ADDRESS,
            rpcUrl: runtime.getSetting('ATTPS_RPC_URL') ?? process.env.ATTPS_RPC_URL,
            privateKey: runtime.getSetting('ATTPS_PRIVATE_KEY') ?? process.env.ATTPS_PRIVATE_KEY,
            autoHashData: (runtime.getSetting('ATTPS_AUTO_HASH_DATA') ?? process.env.ATTPS_AUTO_HASH_DATA) === 'true',
            converterAddress: runtime.getSetting('ATTPS_CONVERTER_ADDRESS') ?? process.env.ATTPS_CONVERTER_ADDRESS,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            elizaLogger.error('Failed to create Agent SDK:', error.message);
        } else {
            elizaLogger.error('Failed to create Agent SDK:', String(error));
        }
        callback({
            text: 'Failed to create Agent SDK. Please check the ATTPs plugin configuration.',
        });
        return;
    }

    // Verify data
    let tx: ContractTransactionResponse
    try {
        tx = await agent.verify(verifyParams)
        elizaLogger.info('Data verification transaction sent. Transaction ID:', tx.hash);

        const receipt = await tx.wait();
        elizaLogger.info('Data verification transaction confirmed. Transaction ID:', receipt.hash);

        callback({
            text: `Success: Data verified successfully. Transaction ID: ${receipt.hash}`,
        })
    } catch (error: unknown) {
        if (error instanceof Error) {
            elizaLogger.error(`Error verify data: ${error.message}`);
            let message = `Error verifying data: ${error.message}`;
            if (tx?.hash) {
                message = `${message} Transaction hash: ${tx.hash}`;
            }
            callback({
                text: message,
            })
        }
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "I want to verify data: ...",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Sure, I'll verify the data.",
          action: "VERIFY",
        },
      },
    ]
  ],
};