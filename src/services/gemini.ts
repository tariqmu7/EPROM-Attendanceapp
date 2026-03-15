import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedData {
  name: string;
  phone: string;
  company: string;
  title: string;
  reason: string;
}

const dataSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "The attendee's full name" },
    phone: { type: Type.STRING, description: "The attendee's phone number" },
    company: { type: Type.STRING, description: "The attendee's company name" },
    title: { type: Type.STRING, description: "The attendee's job title" },
    reason: { type: Type.STRING, description: "The reason for the meeting" }
  },
  required: ["name"]
};

export async function transcribeAndExtract(audioData: { base64: string, mimeType: string }[]): Promise<ExtractedData> {
  const audioParts = audioData.map(audio => ({
    inlineData: {
      data: audio.base64,
      mimeType: audio.mimeType,
    },
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        ...audioParts,
        {
          text: "Extract the following information from the provided audio clips (which may be answers to Name, Phone, Company, Title, and Reason for meeting). If any information is missing, leave it as an empty string.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: dataSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as ExtractedData;
}

export async function analyzeBusinessCard(imageBase64: string, mimeType: string): Promise<ExtractedData> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        },
        {
          text: "Extract the following information from this business card: Name, Phone, Company, Title. Reason for meeting will likely be empty, so leave it as an empty string.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: dataSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as ExtractedData;
}
