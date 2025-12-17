// KLAIRE - Knowledgeable Lead AI & Response Engine

import { supabase } from '@/lib/customSupabaseClient';

const keywords = {
    services: ['service', 'offer', 'do', 'clean', 'provide'],
    pricing: ['price', 'cost', 'how much', 'quote', 'estimate'],
    scheduling: ['schedule', 'appointment', 'book', 'available'],
    contact: ['contact', 'phone', 'number', 'call', 'speak'],
    greeting: ['hello', 'hi', 'hey'],
};

let objectionsCache = null;

async function fetchObjections() {
    if (objectionsCache) return objectionsCache;
    const { data, error } = await supabase.from('objections').select('*');
    if (error) {
        console.error("Error fetching objections:", error);
        return [];
    }
    objectionsCache = data;
    return data;
}

function findKeywordCategory(message) {
    const lowerCaseMessage = message.toLowerCase();
    for (const category in keywords) {
        for (const keyword of keywords[category]) {
            if (lowerCaseMessage.includes(keyword)) {
                return category;
            }
        }
    }
    return null;
}

async function getObjectionResponse(message) {
    const objections = await fetchObjections();
    const lowerCaseMessage = message.toLowerCase();
    for (const objection of objections) {
        if (lowerCaseMessage.includes(objection.keyword.toLowerCase())) {
            return objection.response;
        }
    }
    return null;
}

export function getInitialGreeting(customGreeting) {
    if (customGreeting && customGreeting.trim() !== '') {
        return customGreeting;
    }
    return "Hi there! I'm Klaire, the virtual assistant for The Vent Guys. How can I help you today? You can ask about services, pricing, or scheduling.";
}

export async function processMessage(message, history, leadInfo) {
    let responseText = "";
    let nextStep = null;
    let updatedLeadInfo = {};
    let isFinal = false;

    // First, check for objections
    const objectionResponse = await getObjectionResponse(message);
    if (objectionResponse) {
        return { text: objectionResponse };
    }
    
    // Then, check keyword categories
    const category = findKeywordCategory(message);

    switch (category) {
        case 'services':
            responseText = "We specialize in air duct cleaning, dryer vent cleaning, and improving indoor air quality. Are you interested in a specific service?";
            nextStep = 'service_inquiry';
            break;
        case 'pricing':
            responseText = "Pricing can vary based on the size of your home and specific needs. To give you an accurate quote, could I get your name and phone number? I can have a specialist call you back right away.";
            nextStep = 'lead_capture_name';
            break;
        case 'scheduling':
            responseText = "I can help with that! To get started, what is your name and the service you're interested in?";
            nextStep = 'lead_capture_name';
            break;
        case 'contact':
            responseText = "You can reach our office at (321) 525-4700. If you'd like, I can take your name and number, and we can call you back to save you time.";
            nextStep = 'lead_capture_name';
            break;
        case 'greeting':
            responseText = "Hello! How can I assist you today? Feel free to ask about our services, pricing, or scheduling an appointment.";
            break;
        default:
            responseText = await handleUncategorized(message, history, leadInfo);
            break;
    }

    // This is a simple state machine based on the conversation step
    // A more robust solution would use a dedicated state management library
    if (leadInfo.name && !leadInfo.phone) {
       responseText = `Thanks, ${leadInfo.name}. And what's the best phone number to reach you?`;
       updatedLeadInfo = { ...updatedLeadInfo, phone: message };
       nextStep = 'final_confirmation';
    } else if (!leadInfo.name) {
         if (message.split(' ').length > 1) { // simple name detection
            responseText = `Thanks, ${message}. What service are you interested in?`;
            updatedLeadInfo = { name: message };
            nextStep = 'service_interest';
        }
    }
    
    // A more complex state machine logic would go here
    if (nextStep === 'final_confirmation' && leadInfo.name && updatedLeadInfo.phone) {
      responseText = `Perfect, thank you! We have your name as ${leadInfo.name} and number as ${updatedLeadInfo.phone}. A specialist will contact you shortly. Is there anything else?`;
      isFinal = true;
      updatedLeadInfo = { ...leadInfo, ...updatedLeadInfo};
      nextStep = 'final';
    }


    if (responseText === "") {
        responseText = "I'm sorry, I'm not sure how to help with that. Can I get your name and number to have a human follow up?";
        nextStep = 'lead_capture_name';
    }

    return { text: responseText, nextStep, updatedLeadInfo, isFinal };
}

async function handleUncategorized(message, history, leadInfo) {
    if (!leadInfo.name) {
        return `I'm not sure I understand. To best help you, could I get your name to start?`;
    }
    if (!leadInfo.phone) {
        return `I'm still learning! Could I get your phone number so a specialist can assist you directly?`;
    }
    return "Thanks for that information. I've noted it down. A team member will review this and get back to you.";
}