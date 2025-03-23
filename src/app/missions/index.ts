// Central export file for all mission data
import { WiFiPenTestMission } from './WiFiPenTest';
import { MissionData } from '../utils/MissionManager';

// Export all missions as an array for easy registration
export const allMissions: MissionData[] = [
    WiFiPenTestMission,
    // Add new missions here as they're created
];

// Export individual missions for direct access if needed
export { WiFiPenTestMission };
