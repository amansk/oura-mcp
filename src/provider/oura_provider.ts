import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OuraAuth } from './oura_connection.js';

export interface OuraConfig {
  personalAccessToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export class OuraProvider {
  private server: McpServer;
  private auth: OuraAuth;

  constructor(config: OuraConfig) {
    this.auth = new OuraAuth(
      config.personalAccessToken,
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.server = new McpServer({
      name: "oura-provider",
      version: "1.0.0"
    });

    this.initializeResources();
  }

  private async fetchOuraData(endpoint: string, params?: Record<string, string>): Promise<any> {
    const headers = await this.auth.getHeaders();
    const url = new URL(`${this.auth.getBaseUrl()}/usercollection/${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        // Don't include response body in error to prevent large data logging
        throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Sanitize error message to prevent large data from being logged
      if (error instanceof Error) {
        throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
      } else {
        throw new Error(`Failed to fetch ${endpoint}: Unknown error`);
      }
    }
  }

  private initializeResources(): void {
    // Define the date range schema for tools
    const dateRangeSchema = {
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().describe('End date in YYYY-MM-DD format')
    };

    // Add resources and tools for each endpoint with detailed descriptions
    const endpoints = [
      { 
        name: 'personal_info', 
        requiresDates: false,
        description: 'Get user profile information including age, email, and biological sex'
      },
      { 
        name: 'daily_activity', 
        requiresDates: true,
        description: 'Get daily activity metrics including steps, calories burned, activity targets, movement metrics, and sedentary time. Returns activity score and detailed breakdown.'
      },
      { 
        name: 'daily_readiness', 
        requiresDates: true,
        description: 'Get daily readiness scores and contributing factors including body temperature, HRV balance, recovery metrics, and previous day activity impact. Indicates overall recovery state.'
      },
      { 
        name: 'daily_sleep', 
        requiresDates: true,
        description: 'Get daily sleep summaries including total sleep time, sleep stages breakdown, sleep score, efficiency, and timing. Provides high-level sleep quality insights.'
      },
      { 
        name: 'sleep', 
        requiresDates: true,
        description: 'Get detailed sleep session data with 5-minute granularity including heart rate, HRV, movement, sleep stages, and respiratory rate throughout the night.'
      },
      { 
        name: 'sleep_time', 
        requiresDates: true,
        description: 'Get recommended bedtime windows based on sleep patterns and circadian rhythm. Helps optimize sleep timing for better recovery.'
      },
      { 
        name: 'workout', 
        requiresDates: true,
        description: 'Get workout sessions including activity type, duration, intensity, calories burned, and heart rate data during exercise periods.'
      },
      { 
        name: 'session', 
        requiresDates: true,
        description: 'Get meditation, breathing, or other mindfulness sessions including type, duration, and physiological responses like heart rate and HRV.'
      },
      { 
        name: 'daily_spo2', 
        requiresDates: true,
        description: 'Get daily blood oxygen saturation (SpO2) averages and breathing regularity metrics. Useful for altitude adaptation and respiratory health tracking.'
      },
      { 
        name: 'rest_mode_period', 
        requiresDates: true,
        description: 'Get rest mode periods when the user explicitly enabled rest/recovery mode. Indicates intentional recovery periods or illness.'
      },
      { 
        name: 'ring_configuration', 
        requiresDates: false,
        description: 'Get Oura ring hardware configuration including color, design, firmware version, and hardware generation details.'
      },
      { 
        name: 'daily_stress', 
        requiresDates: true,
        description: 'Get daily stress metrics including daytime stress levels, stress high/recovery time balance, and restoration periods throughout the day.'
      },
      { 
        name: 'daily_resilience', 
        requiresDates: true,
        description: 'Get daily resilience scores showing ability to handle stress based on long-term HRV trends and recovery patterns over the past 2 weeks.'
      },
      { 
        name: 'daily_cardiovascular_age', 
        requiresDates: true,
        description: 'Get estimated cardiovascular age based on HRV, resting heart rate, and other cardiac metrics compared to population norms.'
      },
      { 
        name: 'vO2_max', 
        requiresDates: true,
        description: 'Get estimated VO2 max (maximal oxygen uptake) values indicating cardiovascular fitness level based on heart rate during activities.'
      },
      { 
        name: 'heartrate', 
        requiresDates: true,
        description: 'Get individual heart rate measurements throughout the day including daytime and workout heart rate. Returns BPM values with timestamps and measurement source.'
      },
      { 
        name: 'enhanced_tag', 
        requiresDates: true,
        description: 'Get multi-day tags with optional comments for annotating events, symptoms, or behaviors. Includes tag type, start/end times, and custom notes.'
      }
    ];

    // Add resources
    endpoints.forEach(({ name, requiresDates }) => {
      this.server.resource(
        name,
        `oura://${name}`,
        async (uri) => {
          let data;
          if (requiresDates) {
            // For date-based resources, fetch last 7 days by default
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            data = await this.fetchOuraData(name, { start_date: startDate, end_date: endDate });
          } else {
            data = await this.fetchOuraData(name);
          }

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(data)
            }]
          };
        }
      );
    });

    // Add tools
    endpoints.filter(e => e.requiresDates).forEach(({ name, description }) => {
      this.server.tool(
        `get_${name}`,
        description,
        dateRangeSchema,
        async (args, extra) => {
          // Validate arguments are provided
          if (!args || typeof args !== 'object') {
            throw new Error(`Invalid arguments for ${name}: expected object with startDate and endDate`);
          }
          
          const { startDate, endDate } = args;
          
          // Validate required fields
          if (!startDate || !endDate) {
            throw new Error(`Missing required parameters for ${name}: startDate and endDate are required`);
          }
          
          const data = await this.fetchOuraData(name, {
            start_date: startDate,
            end_date: endDate
          });

          return {
            content: [{
              type: "text",
              text: JSON.stringify(data)
            }]
          };
        }
      );
    });
  }

  getServer(): McpServer {
    return this.server;
  }
} 