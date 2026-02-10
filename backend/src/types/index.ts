import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    role: UserRole;
  };
}

export type UserRole = 'Admin' | 'L1_Auditor' | 'L2_Auditor' | 'Process_Owner';

export interface User {
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 2. THE BLUEPRINT (Static Structure)
export interface AuditTemplate {
  template_id: string;
  template_name: string;
  description: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateSection {
  section_id: string;
  template_id: string;
  section_name: string;
  section_order: number;
  created_at: Date;
}

export type InputType = 'standard' | 'calibration_row' | 'shift_reading';

export interface TemplateQuestion {
  question_id: string;
  section_id: string;
  question_text: string;
  input_type: InputType;
  question_order: number;
  created_at: Date;
}

// 3. THE AUDIT INSTANCE (The Event)
export type AuditStatus = 'Assigned' | 'NC_Open' | 'NC_Pending_Verify' | 'Submitted_to_L2' | 'Completed';

export interface Audit {
  audit_id: string;
  template_id: string;
  machine_name: string;
  audit_date: Date;
  shift: 'A' | 'B' | 'C';
  l1_auditor_id: string;
  l2_auditor_id: string | null;
  process_owner_id: string | null;
  status: AuditStatus;
  created_at: Date;
  updated_at: Date;
}

// 4. DATA CAPTURE (The 4 Distinct Tabs)
// 4A. Standard Checklist
export interface AuditChecklistAnswer {
  answer_id: string;
  audit_id: string;
  question_id: string;
  l1_observation: string | null;
  l2_score: number | null; // 0, 1, 2
  l2_remarks: string | null;
  answered_at: Date;
  scored_at: Date | null;
}

// 4B. Machine Objectives
export interface AuditObjectivesLog {
  objective_id: string;
  audit_id: string;
  parameter_name: string;
  target_value: string;
  actual_value: string | null;
  recorded_at: Date;
}

// 4C. Calibration Log
export interface AuditCalibrationLog {
  calibration_id: string;
  audit_id: string;
  instrument_name: string;
  due_date: Date;
  status: 'OK' | 'Expired';
  recorded_at: Date;
}

// 4D. Process Parameters (Shift Data)
export interface AuditParameterLog {
  parameter_id: string;
  audit_id: string;
  parameter_name: string;
  spec_limit: string | null;
  shift_a_value: string | null;
  shift_b_value: string | null;
  shift_c_value: string | null;
  recorded_at: Date;
}

// 5. THE "NC LOOP" (Process Owner Workflow)
export type NCStatus = 'Open' | 'Pending_Verification' | 'Closed';

export interface NonConformance {
  nc_id: string;
  audit_id: string;
  question_id: string | null;
  issue_description: string;
  nc_date: Date;
  root_cause: string | null;
  corrective_action: string | null;
  evidence_url: string | null;
  status: NCStatus;
  l1_verifier_id: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// AUDIT LOG
export interface AuditLog {
  log_id: string;
  audit_id: string;
  action: string;
  actor_id: string;
  details: Record<string, any> | null;
  created_at: Date;
}
