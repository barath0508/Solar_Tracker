// src/services/mockDb.ts

export interface Profile {
  id: string;
  full_name: string;
  role: 'Visitor' | 'End-User' | 'Technician' | 'Admin';
  phone_number: string;
  email: string;
}

export interface Device {
  id: string;
  name: string;
  serial_number: string;
  owner_id: string;
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'maintenance' | 'fault';
  current_firmware_version: string;
  created_at: string;
}

export interface Telemetry {
  id: number;
  device_id: string;
  v: number;
  i: number;
  p: number;
  temp: number;
  fault: number;
  ldr: number[];
  timestamp: string;
}

export interface Command {
  id: string;
  device_id: string;
  action: 'stow' | 'clean' | 'reboot' | 'calibrate';
  payload: any;
  status: 'pending' | 'sent' | 'executed' | 'failed';
  created_by: string;
  created_at: string;
  executed_at?: string;
}

export interface Alert {
  id: string;
  device_id: string;
  telemetry_id: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

// Default static lists
const DEFAULT_DEVICES: Device[] = [
  {
    id: 'd1e028b0-a541-4702-8c20-3354316d2cf1',
    name: 'Delhi North Tracker #01',
    serial_number: 'SM-ESP32-DL01',
    owner_id: 'user-id-123',
    latitude: 28.7041,
    longitude: 77.1025,
    status: 'online',
    current_firmware_version: 'v1.0.0',
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'fa1c30b2-c510-4322-9213-9118c728e001',
    name: 'Gujarat Kutch Farm #12',
    serial_number: 'SM-ESP32-GJ12',
    owner_id: 'user-id-123',
    latitude: 23.8587,
    longitude: 70.1924,
    status: 'online',
    current_firmware_version: 'v1.0.0',
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'b3c028e2-b108-410a-8d10-4411122a001d',
    name: 'Bangalore Innovation Hub',
    serial_number: 'SM-ESP32-BL44',
    owner_id: 'user-id-123',
    latitude: 12.9716,
    longitude: 77.5946,
    status: 'online',
    current_firmware_version: 'v1.0.2',
    created_at: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'c4d028f0-1e1b-410a-8d20-5511122b002e',
    name: 'Chennai Coastal Array',
    serial_number: 'SM-ESP32-CH21',
    owner_id: 'user-id-123',
    latitude: 13.0827,
    longitude: 80.2707,
    status: 'fault',
    current_firmware_version: 'v1.0.0',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  }
];

class MockDatabase {
  private devices: Device[] = [];
  private telemetry: Record<string, Telemetry[]> = {};
  private commands: Command[] = [];
  private alerts: Alert[] = [];
  private currentUser: Profile | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadState();
    
    // If empty, generate seed historical data
    if (this.devices.length === 0) {
      this.seedData();
    }

    // Start background telemetry generator loop (every 5 seconds)
    setInterval(() => this.generateTelemetryTick(), 5000);
  }

  private loadState() {
    try {
      const u = localStorage.getItem('sm_user');
      this.currentUser = u ? JSON.parse(u) : {
        id: 'user-id-123',
        full_name: 'Aditya Sen',
        role: 'Admin',
        phone_number: '+91 98765 43210',
        email: 'aditya.sen@suryamitra.in'
      };

      const dev = localStorage.getItem('sm_devices');
      this.devices = dev ? JSON.parse(dev) : [];

      const tel = localStorage.getItem('sm_telemetry');
      this.telemetry = tel ? JSON.parse(tel) : {};

      const cmd = localStorage.getItem('sm_commands');
      this.commands = cmd ? JSON.parse(cmd) : [];

      const al = localStorage.getItem('sm_alerts');
      this.alerts = al ? JSON.parse(al) : [];
    } catch (e) {
      console.error('Error loading mock localStorage state', e);
    }
  }

  private saveState() {
    try {
      localStorage.setItem('sm_user', JSON.stringify(this.currentUser));
      localStorage.setItem('sm_devices', JSON.stringify(this.devices));
      localStorage.setItem('sm_telemetry', JSON.stringify(this.telemetry));
      localStorage.setItem('sm_commands', JSON.stringify(this.commands));
      localStorage.setItem('sm_alerts', JSON.stringify(this.alerts));
    } catch (e) {
      console.error('Error saving state to localStorage', e);
    }
    this.notifyListeners();
  }

  private seedData() {
    this.devices = [...DEFAULT_DEVICES];

    // Seed 24 hours of telemetry for each device
    const now = Date.now();
    this.devices.forEach(d => {
      const list: Telemetry[] = [];
      for (let hour = 24; hour > 0; hour--) {
        const time = new Date(now - hour * 3600 * 1000);
        const hourOfDay = time.getHours();

        // Solar pattern simulation
        const solarFactor = hourOfDay > 6 && hourOfDay < 18 ? Math.sin((hourOfDay - 6) / 12 * Math.PI) : 0;
        const v = solarFactor > 0 ? 12 + solarFactor * 8 + (Math.random() - 0.5) : 0;
        const i = solarFactor > 0 ? 1 + solarFactor * 4 + (Math.random() * 0.4) : 0;
        const p = v * i;
        const temp = 25 + solarFactor * 25 + (Math.random() * 5);
        const ldrBase = Math.floor(solarFactor * 3500);

        list.push({
          id: Math.floor(Math.random() * 1000000),
          device_id: d.id,
          v,
          i,
          p,
          temp,
          fault: d.status === 'fault' && hour === 1 ? 3 : 0, // last one is fault if status is fault
          ldr: [
            Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
            Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
            Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
            Math.max(100, Math.floor(ldrBase + (Math.random() - 0.5) * 200)),
          ],
          timestamp: time.toISOString()
        });
      }
      this.telemetry[d.id] = list;
    });

    // Seed alert if device is in fault
    const chennai = this.devices.find(d => d.id === 'c4d028f0-1e1b-410a-8d20-5511122b002e');
    if (chennai) {
      this.alerts.push({
        id: 'alert-chennai-1',
        device_id: chennai.id,
        telemetry_id: this.telemetry[chennai.id][this.telemetry[chennai.id].length - 1].id,
        severity: 'critical',
        message: 'AI Anomaly Detected: Electrical Hotspot pinpointed on panel.',
        is_resolved: false,
        created_at: new Date(Date.now() - 3600 * 1000).toISOString()
      });
    }

    this.saveState();
  }

  // Live updates trigger ticks
  private generateTelemetryTick() {
    const nowStr = new Date().toISOString();
    const hourOfDay = new Date().getHours();
    const solarFactor = hourOfDay > 6 && hourOfDay < 18 ? Math.sin((hourOfDay - 6) / 12 * Math.PI) : 0;

    this.devices.forEach(d => {
      if (d.status === 'offline') return;

      const activeCommands = this.commands.filter(c => c.device_id === d.id && c.status === 'executed');
      const stowed = activeCommands.some(c => c.action === 'stow');
      const cleaning = activeCommands.some(c => c.action === 'clean');

      let v = 0;
      let i = 0;
      let temp = 25 + (Math.random() * 5);
      let fault = 0;
      let ldr = [100, 100, 100, 100];

      if (d.status === 'fault') {
        fault = 3; // Hotspot fault
        v = 6.8;
        i = 1.2;
        temp = 68.2; // overheat
      } else if (stowed) {
        // Safe stowed mode
        v = solarFactor > 0 ? 5 + (Math.random() * 2) : 0;
        i = solarFactor > 0 ? 0.5 : 0;
        temp = 30 + (Math.random() * 3);
        ldr = [1200, 1200, 1200, 1200];
      } else if (cleaning) {
        // Auto tilts, LDR signals swing
        v = solarFactor > 0 ? 8 + (Math.random() * 2) : 0;
        i = solarFactor > 0 ? 0.8 : 0;
        temp = 28;
        ldr = [2500, 1500, 3800, 1000]; // high difference during tilt
      } else {
        // Standard normal operational tracking mode
        v = solarFactor > 0 ? 12 + solarFactor * 8 + (Math.random() - 0.5) : 0;
        i = solarFactor > 0 ? 1 + solarFactor * 4 + (Math.random() * 0.4) : 0;
        temp = 25 + solarFactor * 25 + (Math.random() * 5);
        const ldrBase = Math.floor(solarFactor * 3500);
        // Add random deviation to LDR sensors to represent physical wind/tilt adjustments
        ldr = [
          Math.max(100, Math.floor(ldrBase + 50 + (Math.random() * 50))),
          Math.max(100, Math.floor(ldrBase + 40 + (Math.random() * 50))),
          Math.max(100, Math.floor(ldrBase - 40 - (Math.random() * 50))),
          Math.max(100, Math.floor(ldrBase - 50 - (Math.random() * 50))),
        ];
      }

      const p = v * i;

      // AI Anomaly Generator (2.5% chance per tick for active nodes to trigger a fault class)
      if (d.status === 'online' && Math.random() < 0.025) {
        const randomFault = Math.floor(Math.random() * 6) + 1; // classes 1-6
        fault = randomFault;
        d.status = 'fault';
        
        // Add critical temperature check
        if (Math.random() < 0.3) {
          temp = 69.5; // overheat trigger
        }

        const alertMsg = this.getFaultMessage(fault, temp);
        const telemetryId = Math.floor(Math.random() * 1000000);
        
        const alertObj: Alert = {
          id: `alert-${d.id}-${Date.now()}`,
          device_id: d.id,
          telemetry_id: telemetryId,
          severity: temp > 65 || fault === 4 || fault === 6 ? 'critical' : 'warning',
          message: alertMsg,
          is_resolved: false,
          created_at: nowStr
        };

        this.alerts.unshift(alertObj);
        
        // Push "Simulated Telegram Notification" log in console and storage
        console.log(`🤖 [TELEGRAM BOT WEBHOOK]: Sending Telegram notification to Chat ID: -10049281...`, alertMsg);
      }

      // Add new telemetry row
      const tRow: Telemetry = {
        id: Math.floor(Math.random() * 1000000),
        device_id: d.id,
        v,
        i,
        p,
        temp,
        fault,
        ldr,
        timestamp: nowStr
      };

      if (!this.telemetry[d.id]) this.telemetry[d.id] = [];
      this.telemetry[d.id].push(tRow);
      // Limit list to last 50 entries
      if (this.telemetry[d.id].length > 50) {
        this.telemetry[d.id].shift();
      }
    });

    // Command Queue Simulation Processing
    this.processCommandQueue();

    this.saveState();
  }

  private getFaultMessage(fault: number, temp: number): string {
    if (temp > 65.0) return `Critical temperature anomaly detected: ${temp.toFixed(1)}°C. Risk of thermal hotspot degradation.`;
    switch (fault) {
      case 1: return 'AI Anomaly Detected: Heavy dust accumulation reducing generation by >15%.';
      case 2: return 'AI Anomaly Detected: Structural/neighbor shading fault active.';
      case 3: return 'AI Anomaly Detected: Electrical Hotspot pinpointed on panel.';
      case 4: return 'AI Anomaly Detected: Servo motor blockage / mechanical obstruction.';
      case 5: return 'AI Anomaly Detected: Differential LDR Sensor failure.';
      case 6: return 'AI Anomaly Detected: High-velocity winds. Safe stow active.';
      default: return 'Edge anomaly detected.';
    }
  }

  private processCommandQueue() {
    this.commands.forEach(c => {
      if (c.status === 'pending') {
        c.status = 'sent';
      } else if (c.status === 'sent') {
        c.status = 'executed';
        c.executed_at = new Date().toISOString();

        // Process hardware control side-effects
        const targetDev = this.devices.find(d => d.id === c.device_id);
        if (targetDev) {
          if (c.action === 'reboot') {
            targetDev.status = 'offline';
            // Simulate coming back online after 4 seconds
            setTimeout(() => {
              targetDev.status = 'online';
              this.saveState();
            }, 4000);
          } else if (c.action === 'calibrate') {
            // Firmware updates installation
            if (c.payload?.version) {
              targetDev.current_firmware_version = c.payload.version;
              targetDev.status = 'online';
            }
          }
        }
      }
    });
  }

  // Public APIs matching Supabase Actions
  public getProfile(): Profile | null {
    return this.currentUser;
  }

  public setRole(role: Profile['role']) {
    if (this.currentUser) {
      this.currentUser.role = role;
      this.saveState();
    }
  }

  public getDevices(): Device[] {
    return this.devices;
  }

  public getTelemetry(deviceId: string): Telemetry[] {
    return this.telemetry[deviceId] || [];
  }

  public getCommands(): Command[] {
    return this.commands;
  }

  public getAlerts(): Alert[] {
    return this.alerts;
  }

  public insertCommand(deviceId: string, action: Command['action'], payload: any = {}): Command {
    const newCmd: Command = {
      id: `cmd-${Date.now()}`,
      device_id: deviceId,
      action,
      payload,
      status: 'pending',
      created_by: this.currentUser?.id || 'visitor-uid',
      created_at: new Date().toISOString()
    };

    // Remove conflict clean/stow states if duplicate
    if (action === 'clean' || action === 'stow') {
      this.commands = this.commands.filter(c => !(c.device_id === deviceId && c.action === action));
    }

    this.commands.unshift(newCmd);
    this.saveState();
    return newCmd;
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.is_resolved = true;
      alert.resolved_at = new Date().toISOString();

      // Set device status back to online if all alerts resolved
      const activeAlerts = this.alerts.filter(a => a.device_id === alert.device_id && !a.is_resolved);
      if (activeAlerts.length === 0) {
        const dev = this.devices.find(d => d.id === alert.device_id);
        if (dev && dev.status === 'fault') {
          dev.status = 'online';
        }
      }

      this.saveState();
    }
  }

  public addDevice(dev: Omit<Device, 'id' | 'owner_id' | 'created_at'>): Device {
    const newDev: Device = {
      ...dev,
      id: `dev-${Date.now()}`,
      owner_id: this.currentUser?.id || 'user-id-123',
      created_at: new Date().toISOString()
    };
    this.devices.push(newDev);

    // Seed basic history for this new device
    this.telemetry[newDev.id] = [];
    const now = Date.now();
    for (let hour = 12; hour > 0; hour--) {
      const time = new Date(now - hour * 3600 * 1000);
      this.telemetry[newDev.id].push({
        id: Math.floor(Math.random() * 1000000),
        device_id: newDev.id,
        v: 15 + Math.random() * 3,
        i: 2 + Math.random() * 1.5,
        p: 30 + Math.random() * 20,
        temp: 35 + Math.random() * 5,
        fault: 0,
        ldr: [3000, 2900, 3100, 2980],
        timestamp: time.toISOString()
      });
    }

    this.saveState();
    return newDev;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb());
  }
}

export const mockDb = new MockDatabase();
export default mockDb;
