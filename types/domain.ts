export type Role = 'admin' | 'coach' | 'fencer' | 'guardian'

export interface MembershipType {
  id: string
  name: string
  monthly_fee: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  phone: string | null
  date_of_birth: string | null
  is_active: boolean
  membership_type_id: string | null
  membership_type?: MembershipType
  created_at: string
  updated_at: string
}

export interface ProfileUpdate {
  full_name?: string
  phone?: string
  date_of_birth?: string | null
}

export interface AdminProfileUpdate extends ProfileUpdate {
  role?: Role
  is_active?: boolean
  membership_type_id?: string | null
}
