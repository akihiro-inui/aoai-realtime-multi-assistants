import { ItemCreateMessage, SessionUpdateMessage, ToolsDefinition } from "rt-client";

export class AssistantService {

    language: string = "English";

    private toolsForGenericAssistants = [
        {
            name: 'get_weather',
            description: 'get the weather of the locaion',
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string', description: 'location for the weather' }
                }
            },
            returns: async (arg: string) => `the weather of ${JSON.parse(arg).location} is 40F and rainy`
        }, 
        // If you want to avoid switching the agent, you can remove below and register other tools in parallel to get_weather
        {
            name: 'Assistant_CarAssistant',
            description: 'Help controling car features such as temperature, music, etc.',
            parameters: {
                type: 'object',
                properties: {}
            },
            returns: async (arg: string) => "Assistant_CarAssistant"
        
        }];
    
    // Car specific tools, this agent will be invoked when the user asks about car features
    private toolsForCarAssistants = [
        {
            name: 'control_ac',
            description: 'Control the air conditioning system',
            parameters: {
                type: 'object',
                properties: {
                    temperature: { type: 'number', description: 'desired temperature in Celsius' },
                    mode: { type: 'string', description: 'AC mode like cool, heat, auto' }
                }
            },
            returns: async (arg: string) => `AC set to ${JSON.parse(arg).temperature}C in ${JSON.parse(arg).mode} mode.`
        },
        {
            name: 'control_media',
            description: 'Control media functions like play, pause, next, previous, volume',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', description: 'media action like play, pause, next, volume up' }
                }
            },
            returns: async (arg: string) => `Media action '${JSON.parse(arg).action}' performed.`
        },
        {
            name: 'navigate_to',
            description: 'Provide navigation to a destination',
            parameters: {
                type: 'object',
                properties: {
                    destination: { type: 'string', description: 'destination address or location' }
                }
            },
            returns: async (arg: string) => `Starting navigation to ${JSON.parse(arg).destination}.`
        },
        {
            name: 'control_window',
            description: 'Control window functions like up or down',
            parameters: {
                type: 'object',
                properties: {
                    window: { type: 'string', description: 'window name e.g. front-left, rear-right' },
                    action: { type: 'string', description: 'action like up or down' }
                }
            },
            returns: async (arg: string) => `Window ${JSON.parse(arg).window} ${JSON.parse(arg).action}`
        }
    ];


    public getToolsForAssistant(name: string) {
        let toolsDefinitions: ToolsDefinition = [];
        let toolsToLoad: any[] = [];
        if (name === "GenericAssistant") {
            toolsToLoad = this.toolsForGenericAssistants;
        } else if (name === "CarAssistant") {
            toolsToLoad = this.toolsForCarAssistants;
        } 
        toolsToLoad.forEach(tool => {
            toolsDefinitions.push(
                {
                    type: 'function',
                    name: tool.name,
                    parameters: tool.parameters,
                    description: tool.description,
                });
        });
        return toolsDefinitions;
    }

    public async getToolResponse(toolName: string, parameters: string, call_id: string): Promise<ItemCreateMessage | SessionUpdateMessage> {
        let tools = [...this.toolsForGenericAssistants, ...this.toolsForCarAssistants];
        let content = await tools.find(tool => tool.name === toolName)!.returns(parameters);
        if (content == "Assistant_CarAssistant") {
            let configMessage: SessionUpdateMessage = {
                type: "session.update",

                session: {
                    // You can select different turn detection type here.
                    // Usually server voice activity detection works fine
                    turn_detection: {
                        type: "server_vad",
                    }
                }
            };
            let assistant: [systemMessage: string, tools: any[]] = this.createCarAssistantConfigMessage();
            configMessage.session.instructions = assistant[0];
            // Also, you can set different temperature for different agents.
            configMessage.session.temperature = 0.6;
            configMessage.session.tools = assistant[1];
            return configMessage;
        
        } else if (content == "Assistant_GenericAssistant") {
            let configMessage: SessionUpdateMessage = {
                type: "session.update",

                session: {
                    turn_detection: {
                        type: "server_vad",
                    }
                }
            };
            let assistant: [systemMessage: string, tools: any[]] = this.createGenericAssistantConfigMessage();
            configMessage.session.instructions = assistant[0];
            configMessage.session.temperature = 0.6;
            configMessage.session.tools = assistant[1];
            return configMessage;
        }
        else {
            let response: ItemCreateMessage = {
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: call_id,
                    output: content
                }
            }
            return response;
        }
    }

    public createGenericAssistantConfigMessage(): [systemMessage: string, tools: object[]] {

        const systemMessage: string = `
        ##Role
        You are an expert, well-training agent.
        You are a native speaker of ${this.language} without any accents.
        You are responsible for supporting users to identify their needs, so that we can switch to specialized assistant.
        Use function calling to switch to specialized assistant.
        Introduce yourself as "Audia".
        The user is driving a car.

        ##Rules
        - You are talking with the user. Please provide userful information.
        - When the user provides information you ask, add an appreciation message to your reply.
        - If the user is not satisfied with your answer, you can ask the user to repeat the question or ask the customer to wait for a while.
        - Reply in ${this.language}
        - You MUST follow the following restrictions

        ##Restrictions
        - DO NOT tell that there are several assistants to support the user. You just switch to another one without telling by using function calling.
        - DO NOT answer any question from the user as you are not specialized in any field.
        - You DO NOT need any user identification information as they already have been verified by the system.
        - DO NOT let the user wait as you cannot push the answer later.`;

        return [systemMessage, this.getToolsForAssistant("GenericAssistant")];
    }

    public createCarAssistantConfigMessage(): [systemMessage: string, tools: object[]] {

        const systemMessage: string = `
        ## Role
        You are in car AI Agent. Your role is to help activating the car features.

        ## Rules
        - You MUST use function calling to achieve what the driver is trying to do.
        - You MUST ask clarification of the features if the user intent is unclear.

        ## Restrictions
        - You DO NOT need any user identification information as they already have been verified by the system.
        - You MUST NOT pretend you can activate the funcitons that you do not have access to.
        - DO NOT let the user wait as you cannot push the answer later.`;

        return [systemMessage, this.getToolsForAssistant("CarAssistant")];
    }


}