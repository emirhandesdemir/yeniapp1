
'use server';
/**
 * @fileOverview A Genkit flow to generate an "echo" (image or text) based on recent chat messages.
 *
 * - generateEcho - A function that handles the echo generation process.
 * - GenerateEchoInput - The input type for the generateEcho function.
 * - GenerateEchoOutput - The return type for the generateEcho function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateEchoInputSchema = z.object({
  recentMessages: z
    .array(z.string())
    .min(1, {message: 'At least one message is required for context.'})
    .describe('An array of recent chat messages to provide context for the echo.'),
  desiredOutputType: z
    .enum(['image', 'text'])
    .describe("The desired type of echo to generate: 'image' or 'text'."),
});
export type GenerateEchoInput = z.infer<typeof GenerateEchoInputSchema>;

export const GenerateEchoOutputSchema = z.object({
  outputContent: z
    .string()
    .describe(
      'The generated content. For images, this will be a data URI. For text, this will be the poetic phrase.'
    ),
  actualOutputType: z
    .enum(['image', 'text'])
    .describe('The actual type of content generated.'),
});
export type GenerateEchoOutput = z.infer<typeof GenerateEchoOutputSchema>;

export async function generateEcho(
  input: GenerateEchoInput
): Promise<GenerateEchoOutput> {
  return generateEchoFlow(input);
}

// Define separate prompts for image and text generation for clarity and better control.

const imagePrompt = ai.definePrompt({
  name: 'generateImageEchoPrompt',
  input: {schema: GenerateEchoInputSchema.pick({recentMessages: true})},
  output: {schema: z.object({imageDataUri: z.string()})}, // Expecting data URI directly
  prompt: `Analyze these recent chat messages:
{{#each recentMessages}}- {{{this}}}{{/each}}

Generate an abstract, artistic, and visually intriguing image that captures the mood, theme, or a key concept from these messages. The image should be purely visual, without any text, letters, or numbers. Evoke a feeling or idea rather than a literal depiction.`,
  // Model and config for image generation will be handled in the flow
});

const textPrompt = ai.definePrompt({
  name: 'generateTextEchoPrompt',
  input: {schema: GenerateEchoInputSchema.pick({recentMessages: true})},
  output: {schema: z.object({poeticPhrase: z.string()})},
  prompt: `Analyze these recent chat messages:
{{#each recentMessages}}- {{{this}}}{{/each}}

Write a very short, evocative, poetic phrase (2-3 lines, like a haiku or a short verse, maximum 10-15 words total) that captures the essence or mood of the conversation. Keep it abstract, a bit mysterious, and open to interpretation. Do not directly reference specific names or details from the chat. Focus on feeling and imagery.`,
});


const generateEchoFlow = ai.defineFlow(
  {
    name: 'generateEchoFlow',
    inputSchema: GenerateEchoInputSchema,
    outputSchema: GenerateEchoOutputSchema,
  },
  async (input: GenerateEchoInput): Promise<GenerateEchoOutput> => {
    if (input.desiredOutputType === 'image') {
      try {
        const {media} = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp', // Specific model for image generation
          prompt: [{text: `Recent chat messages for context: \n${input.recentMessages.join("\n - ")}`}, {text: "Generate an abstract, artistic, and visually intriguing image that captures the mood, theme, or a key concept from these messages. The image should be purely visual, without any text, letters, or numbers. Evoke a feeling or idea rather than a literal depiction."}],
          config: {
            responseModalities: ['IMAGE', 'TEXT'], // Must provide both
            // Add safety settings if needed, e.g. to be less restrictive for artistic content
             safetySettings: [
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            ],
          },
        });

        if (media?.url) {
          return {
            outputContent: media.url, // This should be the data URI
            actualOutputType: 'image',
          };
        } else {
          throw new Error('Image generation did not return a media URL.');
        }
      } catch (error) {
        console.error('Error during image echo generation:', error);
        // Fallback to text if image generation fails
        const {output} = await textPrompt({recentMessages: input.recentMessages});
        return {
          outputContent: output?.poeticPhrase || "An unexpected silence, a thought adrift.",
          actualOutputType: 'text',
        };
      }
    } else { // desiredOutputType is 'text'
      try {
        const {output} = await textPrompt({recentMessages: input.recentMessages});
        if (output?.poeticPhrase) {
          return {
            outputContent: output.poeticPhrase,
            actualOutputType: 'text',
          };
        } else {
           throw new Error('Text generation did not return a poetic phrase.');
        }
      } catch (error) {
         console.error('Error during text echo generation:', error);
         return {
            outputContent: "Words dance on the edge of knowing...", // Fallback text
            actualOutputType: 'text',
         };
      }
    }
  }
);
