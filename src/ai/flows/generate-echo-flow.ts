'use server';
/**
 * @fileOverview Basit bir yankı (echo) AI akışı.
 *
 * - generateEcho - Kullanıcının mesajını yankılayan bir fonksiyon.
 * - EchoInput - generateEcho fonksiyonu için giriş tipi.
 * - EchoOutput - generateEcho fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

const echoPrompt = ai.definePrompt({
  name: 'echoPrompt',
  input: {schema: EchoInputSchema},
  output: {schema: EchoOutputSchema},
  prompt: `Aşağıdaki mesajı yankıla: {{{message}}}`,
});

const echoFlow = ai.defineFlow(
  {
    name: 'echoFlow',
    inputSchema: EchoInputSchema,
    outputSchema: EchoOutputSchema,
  },
  async (input) => {
    const {output} = await echoPrompt(input);
    // LLM'in çıktısının EchoOutputSchema'ya uygun olduğunu varsayıyoruz.
    // Eğer LLM doğrudan { echoedMessage: "..." } formatında dönmezse,
    // burada bir dönüşüm gerekebilir. Ancak basit bir yankı için bu yeterli olmalı.
    // Örneğin, LLM sadece metni dönerse: return { echoedMessage: llmResponse.text() };
    if (output) {
        return output;
    }
    // Beklenmedik bir durum için, eğer LLM'den structure'lı output gelmezse,
    // gelen text'i alıp schema'ya uydurabiliriz.
    // Bu, definePrompt içindeki output schema'sının LLM'e doğru formatı bildirmesine bağlıdır.
    // Genellikle Gemini gibi modeller bu formatı anlar.
    const llmResponse = await ai.generate({ prompt: `Aşağıdaki mesajı yankıla: ${input.message}`});
    return { echoedMessage: llmResponse.text };
  }
);
