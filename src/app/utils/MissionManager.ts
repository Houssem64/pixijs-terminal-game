import { EventEmitter } from 'eventemitter3';

// Mission progress states
export enum MissionState {
    LOCKED = 'locked',     // Not available yet
    AVAILABLE = 'available', // Available but not started
    IN_PROGRESS = 'in_progress', // Started but not completed
    COMPLETED = 'completed'  // Successfully completed
}

// Mission completion reward
export interface MissionReward {
    xp: number;        // Experience points
    skillPoints?: {    // Skill-specific points
        [key: string]: number;
    };
    unlocks?: string[];  // IDs of missions or features unlocked
    items?: string[];    // IDs of items rewarded
}

// Mission objective that can be tracked
export interface MissionObjective {
    id: string;
    description: string;
    completed: boolean;
    requiredCommand?: string; // Command that needs to be executed
    requiredOutput?: string;  // Output that should be produced
    requiredFile?: string;    // File that should exist
    expectedFileContent?: string; // Expected content in the file
    autoComplete?: boolean;   // Whether to automatically mark as complete when conditions met
}

// Mission data structure
export interface MissionData {
    id: string;
    title: string;
    description: string;
    category: string;
    difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    objectives: MissionObjective[];
    reward: MissionReward;
    state: MissionState;
    prerequisites?: string[]; // IDs of missions that must be completed first
    timeLimit?: number;      // Time limit in seconds (0 for no limit)
    startTime?: number;      // Timestamp when mission was started
}

// Progress tracking for all missions
export interface PlayerProgress {
    level: number;
    xp: number;
    xpToNextLevel: number;
    rank: string;
    elo: number;
    completedMissions: string[];
    skills: {
        [key: string]: number; // Skill name to level mapping
    };
    inventory: string[];
}

// Define interfaces for the parsed JSON data
interface ParsedMissionData {
    id: string;
    state: MissionState;
    objectives: ParsedObjectiveData[];
}

interface ParsedObjectiveData {
    id: string;
    completed: boolean;
}

export class MissionManager extends EventEmitter {
    private static instance: MissionManager;
    private missions: Map<string, MissionData> = new Map();
    private playerProgress: PlayerProgress;
    private activeMissionId: string | null = null;

    // Rank thresholds and names
    private readonly RANKS = [
        { threshold: 0, name: "Script Kiddie" },
        { threshold: 500, name: "Apprentice Hacker" },
        { threshold: 1000, name: "Ethical Hacker" },
        { threshold: 2000, name: "Penetration Tester" },
        { threshold: 3500, name: "Security Specialist" },
        { threshold: 5000, name: "Cyber Warrior" },
        { threshold: 7500, name: "Elite Hacker" },
        { threshold: 10000, name: "Security Architect" },
        { threshold: 15000, name: "Cyber Guardian" },
        { threshold: 25000, name: "Hacking Legend" }
    ];

    // Level XP requirements (each index is level - 1)
    private readonly LEVEL_XP = [
        0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,  // Levels 1-10
        4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000  // Levels 11-20
    ];

    private constructor() {
        super();
        // Initialize player progress with default values
        this.playerProgress = {
            level: 1,
            xp: 0,
            xpToNextLevel: 100,
            rank: "Script Kiddie",
            elo: 0,
            completedMissions: [],
            skills: {
                "brute_force": 1,
                "penetration_testing": 1,
                "social_engineering": 1,
                "cryptography": 1,
                "network_security": 1
            },
            inventory: []
        };
        
        this.loadProgress();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): MissionManager {
        if (!MissionManager.instance) {
            MissionManager.instance = new MissionManager();
        }
        return MissionManager.instance;
    }

    /**
     * Register a mission with the manager
     */
    public registerMission(mission: MissionData): void {
        this.missions.set(mission.id, mission);
        this.emit('mission-registered', mission.id);
    }

    /**
     * Get a mission by ID
     */
    public getMission(id: string): MissionData | undefined {
        return this.missions.get(id);
    }

    /**
     * Get all missions
     */
    public getAllMissions(): MissionData[] {
        return Array.from(this.missions.values());
    }

    /**
     * Get missions by category
     */
    public getMissionsByCategory(category: string): MissionData[] {
        return Array.from(this.missions.values())
            .filter(mission => mission.category === category);
    }

    /**
     * Start a mission
     */
    public startMission(id: string): boolean {
        const mission = this.missions.get(id);
        if (!mission) return false;
        
        // Check if mission is available
        if (mission.state !== MissionState.AVAILABLE) {
            console.warn(`Mission ${id} is not available`);
            return false;
        }
        
        // Check prerequisites
        if (mission.prerequisites && mission.prerequisites.length > 0) {
            const missingPrereqs = mission.prerequisites.filter(
                prereqId => !this.playerProgress.completedMissions.includes(prereqId)
            );
            
            if (missingPrereqs.length > 0) {
                console.warn(`Missing prerequisites for mission ${id}: ${missingPrereqs.join(', ')}`);
                return false;
            }
        }
        
        // Set mission as active and in progress
        this.activeMissionId = id;
        mission.state = MissionState.IN_PROGRESS;
        mission.startTime = Date.now();
        
        // Reset objective completion
        mission.objectives.forEach(obj => {
            obj.completed = false;
        });
        
        this.saveProgress();
        this.emit('mission-started', id);
        return true;
    }
    
    /**
     * Complete a mission objective
     */
    public completeObjective(missionId: string, objectiveId: string): boolean {
        const mission = this.missions.get(missionId);
        if (!mission) return false;
        
        const objective = mission.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return false;
        
        objective.completed = true;
        this.saveProgress();
        this.emit('objective-completed', { missionId, objectiveId });
        
        // Check if all objectives are completed
        const allCompleted = mission.objectives.every(obj => obj.completed);
        if (allCompleted) {
            this.completeMission(missionId);
        }
        
        return true;
    }

    /**
     * Check if a command completes an objective
     */
    public checkCommandObjective(missionId: string, command: string, output: string): boolean {
        const mission = this.missions.get(missionId);
        if (!mission) return false;
        
        let completedAny = false;
        
        mission.objectives.forEach(objective => {
            if (objective.completed) return;
            
            if (objective.requiredCommand && objective.autoComplete) {
                // Check if command matches exactly or as a regex pattern
                const commandMatches = objective.requiredCommand === command ||
                    (objective.requiredCommand.startsWith('/') && 
                     new RegExp(objective.requiredCommand.slice(1, -1)).test(command));
                
                // Check if output matches if required
                const outputMatches = !objective.requiredOutput || 
                    output.includes(objective.requiredOutput);
                
                if (commandMatches && outputMatches) {
                    objective.completed = true;
                    completedAny = true;
                    this.emit('objective-completed', { missionId, objectiveId: objective.id });
                }
            }
        });
        
        if (completedAny) {
            this.saveProgress();
            
            // Check if all objectives are completed
            const allCompleted = mission.objectives.every(obj => obj.completed);
            if (allCompleted) {
                this.completeMission(missionId);
            }
        }
        
        return completedAny;
    }
    
    /**
     * Check if a file satisfies an objective
     */
    public checkFileObjective(missionId: string, filePath: string, fileContent: string): boolean {
        const mission = this.missions.get(missionId);
        if (!mission) return false;
        
        let completedAny = false;
        
        mission.objectives.forEach(objective => {
            if (objective.completed) return;
            
            if (objective.requiredFile && objective.autoComplete) {
                // Check if file path matches
                const fileMatches = objective.requiredFile === filePath;
                
                // Check if content matches if required
                const contentMatches = !objective.expectedFileContent || 
                    fileContent.includes(objective.expectedFileContent);
                
                if (fileMatches && contentMatches) {
                    objective.completed = true;
                    completedAny = true;
                    this.emit('objective-completed', { missionId, objectiveId: objective.id });
                }
            }
        });
        
        if (completedAny) {
            this.saveProgress();
            
            // Check if all objectives are completed
            const allCompleted = mission.objectives.every(obj => obj.completed);
            if (allCompleted) {
                this.completeMission(missionId);
            }
        }
        
        return completedAny;
    }
    
    /**
     * Complete a mission and grant rewards
     */
    public completeMission(id: string): boolean {
        const mission = this.missions.get(id);
        if (!mission) return false;
        
        // Ensure all objectives are complete
        const allCompleted = mission.objectives.every(obj => obj.completed);
        if (!allCompleted) {
            return false;
        }
        
        // Set mission as completed
        mission.state = MissionState.COMPLETED;
        
        // Add to completed missions if not already there
        if (!this.playerProgress.completedMissions.includes(id)) {
            this.playerProgress.completedMissions.push(id);
            
            // Grant rewards
            this.grantReward(mission.reward);
            
            // Unlock new missions
            if (mission.reward.unlocks) {
                mission.reward.unlocks.forEach(unlockId => {
                    const unlockedMission = this.missions.get(unlockId);
                    if (unlockedMission && unlockedMission.state === MissionState.LOCKED) {
                        unlockedMission.state = MissionState.AVAILABLE;
                        this.emit('mission-unlocked', unlockId);
                    }
                });
            }
        }
        
        // Clear active mission if this was it
        if (this.activeMissionId === id) {
            this.activeMissionId = null;
        }
        
        this.saveProgress();
        this.emit('mission-completed', id);
        return true;
    }
    
    /**
     * Grant rewards to the player
     */
    private grantReward(reward: MissionReward): void {
        // Add XP
        this.playerProgress.xp += reward.xp;
        
        // Add skill points
        if (reward.skillPoints) {
            Object.entries(reward.skillPoints).forEach(([skill, points]) => {
                this.playerProgress.skills[skill] = (this.playerProgress.skills[skill] || 0) + points;
            });
        }
        
        // Add items to inventory
        if (reward.items) {
            this.playerProgress.inventory.push(...reward.items);
        }
        
        // Update level based on XP
        this.updateLevel();
        
        // Update ELO rating
        this.updateElo(reward.xp);
        
        this.emit('rewards-granted', reward);
    }
    
    /**
     * Update player level based on XP
     */
    private updateLevel(): void {
        let newLevel = 1;
        for (let i = 0; i < this.LEVEL_XP.length; i++) {
            if (this.playerProgress.xp >= this.LEVEL_XP[i]) {
                newLevel = i + 1;
            } else {
                break;
            }
        }
        
        // Calculate XP needed for next level
        const nextLevelIndex = newLevel;
        const xpForNextLevel = nextLevelIndex < this.LEVEL_XP.length ? 
            this.LEVEL_XP[nextLevelIndex] : Number.MAX_VALUE;
        this.playerProgress.xpToNextLevel = xpForNextLevel - this.playerProgress.xp;
        
        // If level changed
        if (newLevel !== this.playerProgress.level) {
            const oldLevel = this.playerProgress.level;
            this.playerProgress.level = newLevel;
            this.emit('level-up', { oldLevel, newLevel });
        }
    }
    
    /**
     * Update ELO rating based on mission difficulty
     */
    private updateElo(xpGained: number): void {
        // Simple ELO calculation - each XP point increases ELO by 2
        const eloGain = xpGained * 2;
        this.playerProgress.elo += eloGain;
        
        // Update rank based on new ELO
        let newRank = this.RANKS[0].name;
        for (const rank of this.RANKS) {
            if (this.playerProgress.elo >= rank.threshold) {
                newRank = rank.name;
            } else {
                break;
            }
        }
        
        if (newRank !== this.playerProgress.rank) {
            const oldRank = this.playerProgress.rank;
            this.playerProgress.rank = newRank;
            this.emit('rank-up', { oldRank, newRank });
        }
    }
    
    /**
     * Get player progress data
     */
    public getPlayerProgress(): PlayerProgress {
        return { ...this.playerProgress };
    }
    
    /**
     * Get active mission ID
     */
    public getActiveMissionId(): string | null {
        return this.activeMissionId;
    }
    
    /**
     * Save progress to local storage
     */
    private saveProgress(): void {
        try {
            // Save missions data
            const missionsData = Array.from(this.missions.entries())
                .map(([id, mission]) => ({
                    id,
                    state: mission.state,
                    objectives: mission.objectives.map(obj => ({
                        id: obj.id,
                        completed: obj.completed
                    }))
                }));
            
            localStorage.setItem('missions', JSON.stringify(missionsData));
            
            // Save player progress
            localStorage.setItem('playerProgress', JSON.stringify(this.playerProgress));
            
            // Save active mission
            localStorage.setItem('activeMission', this.activeMissionId || '');
        } catch (error) {
            console.error('Failed to save progress', error);
        }
    }
    
    /**
     * Load progress from local storage
     */
    private loadProgress(): void {
        try {
            // Load player progress
            const progressData = localStorage.getItem('playerProgress');
            if (progressData) {
                this.playerProgress = JSON.parse(progressData);
            }
            
            // Load missions data
            const missionsData = localStorage.getItem('missions');
            if (missionsData) {
                const parsedData = JSON.parse(missionsData) as ParsedMissionData[];
                parsedData.forEach((data: ParsedMissionData) => {
                    const mission = this.missions.get(data.id);
                    if (mission) {
                        mission.state = data.state;
                        
                        // Update objectives completion
                        data.objectives.forEach((objData: ParsedObjectiveData) => {
                            const objective = mission.objectives.find(obj => obj.id === objData.id);
                            if (objective) {
                                objective.completed = objData.completed;
                            }
                        });
                    }
                });
            }
            
            // Load active mission
            const activeMission = localStorage.getItem('activeMission');
            if (activeMission && activeMission !== '') {
                this.activeMissionId = activeMission;
            }
        } catch (error) {
            console.error("Error loading progress:", error);
        }
    }
} 