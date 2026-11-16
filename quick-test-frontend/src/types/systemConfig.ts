/**
 * Category classification for system configurations
 */
export type SystemConfigCategory = 'RATE_LIMIT' | 'GEMINI_AI' | 'SYSTEM_GENERAL';

/**
 * Underlying value data type
 */
export type SystemConfigValueType = 'STRING' | 'INTEGER' | 'BOOLEAN' | 'DOUBLE' | 'JSON';

/**
 * Active resolution source
 */
export type SystemConfigSource = 'DATABASE' | 'ENVIRONMENT';

/**
 * System configuration item details
 */
export interface SystemConfigItem {
  key: string;
  value: string;
  defaultValue: string;
  valueType: SystemConfigValueType;
  category: SystemConfigCategory;
  label: string;
  description: string;
  source: SystemConfigSource;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Update request payload
 */
export interface SystemConfigUpdateRequest {
  value: string;
}
