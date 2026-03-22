// Admin Portal TypeScript Interfaces
// Extracted from /app/portal/src/app/admin/page.tsx

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone?: string;
  sms?: string;
  whatsapp?: string;
  specialization?: string;
  area?: string;
  background?: string;
  years_served?: string;
  is_supervisor?: boolean;
  created_at?: string;
  has_profile?: boolean;
  _source?: string;
}

export interface CallLog {
  id: string;
  contact_name?: string;
  contact_type?: string;
  contact_phone?: string;
  call_method?: string;
  timestamp?: string;
  created_at?: string;
}

export interface ChatRoom {
  id: string;
  user_session_id?: string;
  user_name?: string;
  staff_name?: string;
  status: string;
  created_at: string;
  message_count?: number;
}

export interface SafeguardingAlert {
  id: string;
  user_name?: string;
  risk_level: string;
  risk_score?: number;
  score?: number;
  trigger_phrase?: string;
  triggered_indicators?: string[];
  triggering_message?: string;
  session_id?: string;
  status: string;
  created_at: string;
  acknowledged_by?: string;
  resolved_by?: string;
  geo_city?: string;
  geo_country?: string;
  location_city?: string;
  location_country?: string;
  ip_address?: string;
  isp?: string;
  timezone?: string;
  user_agent?: string;
  conversation_history?: any[];
}

export interface AICharacter {
  id: string;
  name: string;
  description?: string;
  bio?: string;
  prompt?: string;
  avatar?: string;
  is_enabled: boolean;
  order?: number;
  category?: string;
  personality?: string;
  background?: string;
  greeting_message?: string;
  voice_style?: string;
  is_hardcoded?: boolean;
}

export interface AIUsageSummary {
  total_tokens?: number;
  total_cost_gbp?: number;
  total_cost?: number;
  total_requests?: number;
  providers?: Record<string, { 
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_gbp?: number;
    request_count?: number;
    budget_limit_gbp?: number;
    budget_remaining_gbp?: number;
    budget_percentage_used?: number;
  }>;
  by_provider?: Record<string, { tokens: number; cost: number }>;
  by_character?: Array<{ character_name?: string; name?: string; request_count?: number; requests?: number; cost_gbp?: number; cost?: number }>;
}
