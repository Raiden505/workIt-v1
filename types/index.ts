export type UserRole = "client" | "freelancer";

export interface User {
  id: number;
  email: string;
  password: string;
  is_verified: boolean;
  created_at: string;
}

export interface Profile {
  user_id: number;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface Client {
  user_id: number;
  company_name: string | null;
}

export interface Freelancer {
  user_id: number;
  hourly_rate: number;
  portfolio_url: string | null;
}

export type JobStatus = "open" | "in_progress" | "completed" | "cancelled";
export type ProposalStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type ContractStatus = "active" | "completed" | "terminated";
export type TransactionStatus = "pending" | "completed" | "failed" | "refunded";

export interface Job {
  id: number;
  client_id: number | null;
  category_id: number | null;
  title: string;
  description: string;
  budget: number;
  status: JobStatus;
  created_at: string;
}

export interface Proposal {
  id: number;
  job_id: number | null;
  freelancer_id: number | null;
  bid_amount: number | null;
  status: ProposalStatus | null;
  created_at: string;
}

export interface Contract {
  id: number;
  proposal_id: number | null;
  job_id: number | null;
  freelancer_id: number | null;
  total_price: number;
  status: ContractStatus | null;
  start_date: string;
  end_date: string;
}

export interface Transactions {
  id: number;
  contract_id: number | null;
  sender_id: number | null;
  receiver_id: number | null;
  amount: number;
  status: TransactionStatus | null;
  created_at: string;
}

export interface SessionUser {
  userId: string | null;
  clientId: string | null;
  freelancerId: string | null;
  activeRole: UserRole | null;
}
