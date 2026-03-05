export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      applicants: {
        Row: {
          id: string
          email: string
          phone_number: string
          prenom: string
          nom: string
          date_naissance: string
          password_hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          phone_number: string
          prenom: string
          nom: string
          date_naissance: string
          password_hash: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone_number?: string
          prenom?: string
          nom?: string
          date_naissance?: string
          password_hash?: string
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          applicant_id: string
          user_id: string
          intake_year: number
          ecole_provenance: string
          option_academique: string
          exam_status: 'En attente des résultats' | 'Diplôme obtenu'
          application_status: 'Dossier Créé' | 'Frais Réglés' | 'En Cours d\'Évaluation' | 'Admission sous réserve' | 'Admission définitive' | 'Dossier refusé'
          payment_status: 'Pending' | 'Confirmed' | 'Failed'
          transaction_id: string | null
          payment_confirmed_at: string | null
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          user_id: string
          intake_year: number
          ecole_provenance: string
          option_academique: string
          exam_status: 'En attente des résultats' | 'Diplôme obtenu'
          application_status?: 'Dossier Créé' | 'Frais Réglés' | 'En Cours d\'Évaluation' | 'Admission sous réserve' | 'Admission définitive' | 'Dossier refusé'
          payment_status?: 'Pending' | 'Confirmed' | 'Failed'
          transaction_id?: string | null
          payment_confirmed_at?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          user_id?: string
          intake_year?: number
          ecole_provenance?: string
          option_academique?: string
          exam_status?: 'En attente des résultats' | 'Diplôme obtenu'
          application_status?: 'Dossier Créé' | 'Frais Réglés' | 'En Cours d\'Évaluation' | 'Admission sous réserve' | 'Admission définitive' | 'Dossier refusé'
          payment_status?: 'Pending' | 'Confirmed' | 'Failed'
          transaction_id?: string | null
          payment_confirmed_at?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      admissions_officers: {
        Row: {
          id: string
          email: string
          password_hash: string
          prenom: string
          nom: string
          role: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          prenom: string
          nom: string
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          prenom?: string
          nom?: string
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      audit_trail: {
        Row: {
          id: string
          applicant_id: string
          admin_id: string
          previous_status: string
          new_status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          admin_id: string
          previous_status: string
          new_status: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          admin_id?: string
          previous_status?: string
          new_status?: string
          notes?: string | null
          created_at?: string
        }
      }
      uploaded_documents: {
        Row: {
          id: string
          applicant_id: string
          user_id: string
          file_name: string
          file_path: string
          file_size_bytes: number
          mime_type: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          user_id: string
          file_name: string
          file_path: string
          file_size_bytes: number
          mime_type: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          user_id?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          mime_type?: string
          uploaded_at?: string
        }
      }
      email_logs: {
        Row: {
          id: string
          applicant_id: string
          recipient_email: string
          subject: string
          email_type: string
          status: 'sent' | 'failed' | 'pending'
          error_message: string | null
          retry_count: number
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          applicant_id: string
          recipient_email: string
          subject: string
          email_type: string
          status?: 'sent' | 'failed' | 'pending'
          error_message?: string | null
          retry_count?: number
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          applicant_id?: string
          recipient_email?: string
          subject?: string
          email_type?: string
          status?: 'sent' | 'failed' | 'pending'
          error_message?: string | null
          retry_count?: number
          sent_at?: string | null
          created_at?: string
        }
      }
      webhook_logs: {
        Row: {
          id: string
          transaction_id: string
          payload: Json
          received_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          payload: Json
          received_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          payload?: Json
          received_at?: string
        }
      }
      applicant_id_sequences: {
        Row: {
          intake_year: number
          current_sequence: number
          updated_at: string
        }
        Insert: {
          intake_year: number
          current_sequence?: number
          updated_at?: string
        }
        Update: {
          intake_year?: number
          current_sequence?: number
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_applicant_id: {
        Args: {
          p_intake_year: number
        }
        Returns: string
      }
      update_application_status_with_version_check: {
        Args: {
          p_applicant_id: string
          p_new_status: string
          p_expected_version: number
        }
        Returns: boolean
      }
    }
    Enums: {
      application_status_enum: 'Dossier Créé' | 'Frais Réglés' | 'En Cours d\'Évaluation' | 'Admission sous réserve' | 'Admission définitive' | 'Dossier refusé'
      payment_status_enum: 'Pending' | 'Confirmed' | 'Failed'
      exam_status_enum: 'En attente des résultats' | 'Diplôme obtenu'
      email_status_enum: 'sent' | 'failed' | 'pending'
    }
  }
}
