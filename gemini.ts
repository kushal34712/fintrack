
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const enhanceTransactionDetails = async (note: string, categories: string[]) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Cleaning and categorizing this financial note: "${note}".
      Available categories: ${categories.join(', ')}.
      Return a concise cleaned version of the note and the best matching category.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanNote: { type: Type.STRING, description: 'Short cleaned version of the note' },
            suggestedCategory: { type: Type.STRING, description: 'Matching category from the list' }
          },
          required: ['cleanNote', 'suggestedCategory']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("AI Enhancement failed:", error);
    return null;
  }
};
