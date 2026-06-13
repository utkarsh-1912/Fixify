import Link from 'next/link';
import { Home, Compass, AlertTriangle, ArrowLeft, Terminal } from 'lucide-react';

export default function NotFound() {
  const mockFixFields = [
    { tag: '8', name: 'BeginString', value: 'FIX.4.4', desc: 'Protocol version' },
    { tag: '35', name: 'MsgType', value: '3', desc: 'Session Reject (Notice of invalid path)' },
    { tag: '34', name: 'MsgSeqNum', value: '404', desc: 'Sequence number representing status code' },
    { tag: '49', name: 'SenderCompID', value: 'FIXIFY', desc: 'The application sending this reject' },
    { tag: '56', name: 'TargetCompID', value: 'VISITOR', desc: 'The client targeting the resource' },
    { tag: '58', name: 'Text', value: 'Page Not Found - HTTP 404 - Route Unreachable', desc: 'Error description text' },
    { tag: '373', name: 'SessionRejectReason', value: '1', desc: 'Required Tag Missing / Invalid Route' },
    { tag: '10', name: 'CheckSum', value: '198', desc: 'Message checksum' },
  ];

  const rawFixMessage = "8=FIX.4.4\x019=156\x0135=3\x0134=404\x0149=FIXIFY\x0156=VISITOR\x0158=Page Not Found - HTTP 404 - Route Unreachable\x01373=1\x0110=198\x01";

  return (
    <div className="flex flex-col items-center justify-center py-10 md:py-16 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Visual Glitch Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-2" style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
          <Compass className="h-8 w-8 text-[var(--primary)] animate-pulse" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight font-mono" style={{ color: 'var(--foreground)' }}>
          404
        </h1>
        <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
          Destination Route Unreachable
        </h2>
        <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
          The requested page sequence could not be matched with any active route definitions. A session reject message has been dispatched.
        </p>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link href="/" className="fx-btn-primary justify-center">
          <Home className="h-4 w-4" /> Go back to Console
        </Link>
        <Link href="/fixtags" className="fx-btn-secondary justify-center">
          <Compass className="h-4 w-4" /> Browse Dictionary
        </Link>
      </div>

      {/* Simulated FIX Reject Packet */}
      <div className="w-full fx-card space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
          <span className="fx-section-label flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
            Incoming Reject Packet (RAW)
          </span>
          <span className="badge-success bg-red-500/10 border-red-500/20 text-red-400 font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">
            REJECT_ROUTE
          </span>
        </div>

        <div 
          className="p-3.5 rounded-lg text-xs break-all font-mono leading-relaxed" 
          style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          {rawFixMessage.replaceAll('\x01', ' | ')}
        </div>

        {/* Tag Breakdown */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Parsed Tag Analysis
          </p>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-[11px] font-mono text-left">
              <thead>
                <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-3 font-semibold w-12 text-center">Tag</th>
                  <th className="py-2 px-3 font-semibold">Field Name</th>
                  <th className="py-2 px-3 font-semibold">Value</th>
                  <th className="py-2 px-3 font-semibold hidden sm:table-cell">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {mockFixFields.map((field) => (
                  <tr key={field.tag} className="border-b hover:bg-zinc-800/10 dark:hover:bg-zinc-900/30" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="py-2 px-3 font-bold text-center" style={{ color: 'var(--primary)' }}>{field.tag}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--foreground)' }}>{field.name}</td>
                    <td className="py-2 px-3 font-semibold text-red-400">{field.value}</td>
                    <td className="py-2 px-3 text-[10px] hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{field.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
