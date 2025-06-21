'use server';
/**
 * @fileOverview Basit bir yankı (echo) AI akışı.
 *
 * - generateEcho - Kullanıcının mesajını yankılayan bir fonksiyon.
 * - EchoInput - generateEcho fonksiyonu için giriş tipi.
 * - EchoOutput - generateEcho fonksiyonu için dönüş tipi.
 */

import { defineFlow, generate } from 'genkit/ai';
import { z } from 'zod';

const EchoInputSchema = z.object({
  message: z.string().describe('Yankılanacak mesaj.'),
});
export type EchoInput = z.infer<typeof EchoInputSchema>;

const EchoOutputSchema = z.object({
  echoedMessage: z.string().describe('Yankılanan mesaj.'),
});
export type EchoOutput = z.infer<typeof EchoOutputSchema>;

export async function generateEcho(input: EchoInput): Promise<EchoOutput> {
  return echoFlow(input);
}

const echoFlow = defineFlow(
  {
    name: 'echoFlow',
    inputSchema: EchoInputSchema,
    outputSchema: EchoOutputSchema,
  },
  async (input) => {
    const llmResponse = await generate({
      model: 'googleai/gemini-pro',
      prompt: `Aşağıdaki mesajı yankıla: ${input.message}`,
      output: {
        format: 'json',
        schema: EchoOutputSchema,
      },
    });

    return llmResponse.output()!;
  }
);
