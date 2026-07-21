import { RegisterForm } from "@/components/organizer/register-form"

export default function RegisterPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const rawEmail = Array.isArray(searchParams.email) ? searchParams.email[0] : searchParams.email
  const initialEmail = rawEmail?.trim().toLowerCase() ?? ""

  return <RegisterForm initialEmail={initialEmail} />
}
