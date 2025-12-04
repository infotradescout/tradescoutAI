
import { GoogleGenAI } from "@google/genai";

// Simplified list for the demo. In a real app, use a full library or API.
export const US_STATES = [
    { name: 'Alabama', code: 'AL' }, { name: 'Alaska', code: 'AK' }, { name: 'Arizona', code: 'AZ' },
    { name: 'Arkansas', code: 'AR' }, { name: 'California', code: 'CA' }, { name: 'Colorado', code: 'CO' },
    { name: 'Connecticut', code: 'CT' }, { name: 'Delaware', code: 'DE' }, { name: 'Florida', code: 'FL' },
    { name: 'Georgia', code: 'GA' }, { name: 'Hawaii', code: 'HI' }, { name: 'Idaho', code: 'ID' },
    { name: 'Illinois', code: 'IL' }, { name: 'Indiana', code: 'IN' }, { name: 'Iowa', code: 'IA' },
    { name: 'Kansas', code: 'KS' }, { name: 'Kentucky', code: 'KY' }, { name: 'Louisiana', code: 'LA' },
    { name: 'Maine', code: 'ME' }, { name: 'Maryland', code: 'MD' }, { name: 'Massachusetts', code: 'MA' },
    { name: 'Michigan', code: 'MI' }, { name: 'Minnesota', code: 'MN' }, { name: 'Mississippi', code: 'MS' },
    { name: 'Missouri', code: 'MO' }, { name: 'Montana', code: 'MT' }, { name: 'Nebraska', code: 'NE' },
    { name: 'Nevada', code: 'NV' }, { name: 'New Hampshire', code: 'NH' }, { name: 'New Jersey', code: 'NJ' },
    { name: 'New Mexico', code: 'NM' }, { name: 'New York', code: 'NY' }, { name: 'North Carolina', code: 'NC' },
    { name: 'North Dakota', code: 'ND' }, { name: 'Ohio', code: 'OH' }, { name: 'Oklahoma', code: 'OK' },
    { name: 'Oregon', code: 'OR' }, { name: 'Pennsylvania', code: 'PA' }, { name: 'Rhode Island', code: 'RI' },
    { name: 'South Carolina', code: 'SC' }, { name: 'South Dakota', code: 'SD' }, { name: 'Tennessee', code: 'TN' },
    { name: 'Texas', code: 'TX' }, { name: 'Utah', code: 'UT' }, { name: 'Vermont', code: 'VT' },
    { name: 'Virginia', code: 'VA' }, { name: 'Washington', code: 'WA' }, { name: 'West Virginia', code: 'WV' },
    { name: 'Wisconsin', code: 'WI' }, { name: 'Wyoming', code: 'WY' }
];

export const lookupCountyFromLatLng = async (lat: number, lng: number): Promise<{ stateCode: string, countyCode: string } | null> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        // We use Gemini to determine location context from coordinates as a fallback/intelligent guess
        // In production, you might want to use the Google Maps Geocoding API directly or via tools.
        // For this demo, using the model to identify location is sufficient and demonstrates the SDK usage.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Identify the US State (2 letter code) and County name for these coordinates: ${lat}, ${lng}. 
            Return a JSON object with keys "stateCode" and "countyCode". 
            Example: { "stateCode": "TX", "countyCode": "Travis" }`,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const data = JSON.parse(response.text);
        if (data.stateCode && data.countyCode) {
            return {
                stateCode: data.stateCode,
                countyCode: data.countyCode
            };
        }
        return null;
    } catch (error) {
        console.error("Location lookup failed", error);
        return null;
    }
};
