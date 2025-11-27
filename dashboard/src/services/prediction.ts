import axios from "axios";

// Helper function to validate base64 string
const isValidBase64 = (str: string): boolean => {
    try {
        return btoa(atob(str)) === str;
    } catch (err) {
        return false;
    }
};

// Helper function to ensure proper base64 format
const formatBase64Image = (image: string): string => {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // Validate the base64 string
    if (!isValidBase64(base64Data)) {
        throw new Error('Invalid base64 image format');
    }
    
    return base64Data;
};

export const getPrediction = async (image: string) => {
    try {
        // Validate and format the base64 image
        const formattedImage = formatBase64Image(image);
        const response = await axios.post('/api/prediction', {
            image_base64: formattedImage,
        });
        
        console.log("Prediction response received:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching prediction:", error);
        
        if (axios.isAxiosError(error)) {
            console.error("Axios error details:", error.response?.data);
        }
        
        if (error instanceof Error && error.message === 'Invalid base64 image format') {
            throw new Error('Please provide a valid base64 encoded image');
        }
        throw error;
    }
}