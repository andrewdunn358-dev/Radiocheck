/**
 * AI Chat - Redirects to unified chat component based on query parameter
 * The unified chat at /chat/[characterId] has full theme support
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AIChatRedirect() {
  const { character = 'tommy' } = useLocalSearchParams<{ character: string }>();
  
  // Redirect to the unified chat with the character ID
  return <Redirect href={`/chat/${character}`} />;
}
