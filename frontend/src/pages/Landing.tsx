import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Rocket, Users } from 'lucide-react'
import { roomanStats } from '../data/mockData'

export function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4500] text-lg font-black text-white">
            R
          </span>
          <span className="text-[15px] font-bold text-[#1c1c1c]">
            Roo<span className="text-[#ff4500]">Connect</span>
          </span>
        </div>
        <Link to="/login" className="text-sm font-semibold text-[#ff4500] hover:underline">
          Already a member? Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-12 text-center">
        <span className="inline-block rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-[#ff4500]">
          Rooman Technologies · 25 Years of Building Careers
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#1c1c1c] sm:text-5xl">
          Welcome to the <span className="text-[#ff4500]">Rooman Alumni Network</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[#878a8c]">
          Reconnect with 500,000+ alumni. Find jobs, mentor the next generation, and build your
          startup — all within the network that trained you.
        </p>

        <button
          onClick={() => navigate('/accept-invite')}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ff4500] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-[#ff6534]"
        >
          Accept Invite & Join Now <ArrowRight size={20} />
        </button>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { v: roomanStats.alumni, l: 'Alumni Trained' },
            { v: `${roomanStats.years} yrs`, l: 'Of Excellence' },
            { v: roomanStats.reach, l: 'Presence' },
            { v: `${roomanStats.centers}+`, l: 'Training Centers' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-[#edeff1] bg-white p-5 shadow-sm">
              <p className="text-2xl font-extrabold text-[#ff4500]">{s.v}</p>
              <p className="mt-1 text-sm text-[#878a8c]">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Benefit
            icon={<Users size={28} />}
            title="Community Network"
            body="Connect with alumni across companies and cities. Share opportunities, get referrals and help each other grow."
          />
          <Benefit
            icon={<GraduationCap size={28} />}
            title="Paid Mentorship"
            body="Conduct mentorship sessions on Rooman programs at industry rates. Give back while you earn."
          />
          <Benefit
            icon={<Rocket size={28} />}
            title="StartupVarsity"
            body="Build your product using Rooman's labs, mentors and seed support. Turn your idea into a company."
          />
        </div>

        <div className="mt-12 rounded-2xl bg-gradient-to-r from-[#ff4500] to-[#ff6534] p-8 text-center text-white">
          <h2 className="text-2xl font-bold">Your network is waiting.</h2>
          <p className="mt-2 text-orange-50">Join thousands of Rooman alumni already connected.</p>
          <button
            onClick={() => navigate('/accept-invite')}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#ff4500] hover:bg-orange-50"
          >
            Accept Invite & Join Now <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="border-t border-[#edeff1] py-6 text-center text-sm text-[#878a8c]">
        © 2026 Rooman Technologies · Alumni Network
      </footer>
    </div>
  )
}

function Benefit({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-[#edeff1] bg-white p-6 shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 text-[#ff4500]">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-[#1c1c1c]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#878a8c]">{body}</p>
    </div>
  )
}
