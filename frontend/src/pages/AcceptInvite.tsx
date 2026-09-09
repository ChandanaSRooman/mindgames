import { Link } from 'react-router-dom'
import { GraduationCap, Briefcase, Rocket, ShieldCheck, MailCheck } from 'lucide-react'
import { Card } from '../components/ui'

// This app is invite-only: an administrator adds you and sends an invite,
// which creates your account and emails you its login credentials directly
// (see backend/src/routes/invites.routes.ts) — there is no self-service
// sign-up. This page used to run that self-service flow (email a code,
// verify it, set a password); it's kept at the same URL, since invite emails
// and other links already point here, but now explains the real flow instead
// of offering a form that the backend will reject every submission from.

const BENEFITS = [
  { icon: <Briefcase size={18} />, title: 'Paid Mentorship', desc: 'Earn by guiding juniors, or get matched with a senior mentor.' },
  { icon: <Rocket size={18} />, title: 'StartupVarsity Incubation', desc: 'Access incubation support and funding pathways for your ideas.' },
  { icon: <ShieldCheck size={18} />, title: 'Trusted Network', desc: 'A verified community of Rooman alumni and hiring managers.' },
]

export function AcceptInvite() {
  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Welcome / benefits */}
        <div className="flex flex-col justify-center px-6 py-12 lg:px-12">
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#ff4500] text-white">
              <GraduationCap size={22} />
            </div>
            <span className="text-sm font-semibold text-[#878a8c]">Rooman Alumni Network</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-[#1c1c1c] sm:text-4xl">
            You're invited to join your alumni network.
          </h1>
          <p className="mt-3 max-w-md text-[#878a8c]">
            Reconnect, grow, and give back. Here's what's waiting for you inside.
          </p>
          <div className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-orange-100 text-[#ff4500]">
                  {b.icon}
                </div>
                <div>
                  <p className="font-medium text-[#1c1c1c]">{b.title}</p>
                  <p className="text-sm text-[#878a8c]">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info card */}
        <div className="flex items-center justify-center px-6 py-12 lg:px-12">
          <Card className="w-full max-w-md p-6 sm:p-8">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-orange-100 text-[#ff4500]">
              <MailCheck size={22} />
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[#1c1c1c]">Check your email to join</h2>
            <p className="mt-1 text-sm text-[#878a8c]">
              This network is invite-only. When an administrator invites you, we email your account's
              sign-in details directly — there's nothing to fill in here.
            </p>
            <p className="mt-4 text-sm text-[#878a8c]">
              Haven't received an invite yet? Ask your administrator to add you, or check your spam
              folder for an email from the Rooman team.
            </p>

            <Link
              to="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#ff4500] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#ff6534]"
            >
              Go to sign in
            </Link>

            <p className="mt-4 text-center text-xs text-[#878a8c]">
              By continuing you agree to the network's community guidelines.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
