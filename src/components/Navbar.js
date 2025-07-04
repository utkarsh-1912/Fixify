'use client';
import { useState } from 'react';
import Link from "next/link";
import Image from 'next/image';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Logs Processor' },
    { href: '/xml', label: 'XML Formatter' },
    { href: '/compare', label: 'Comparator' },
    { href: '/interpreter', label: 'Interpreter' },
  ];

  return (
    <nav className="bg-gray-200 text-gray-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-screen-xl mx-auto">
        {/* Logo Section */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo-full.png"
            alt="FIXify"
            width={96}
            height={32}
            className="h-8 w-24"
          />
        </Link>

        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <XMarkIcon className="h-6 w-6 text-gray-900" />
          ) : (
            <Bars3Icon className="h-6 w-6 text-gray-900" />
          )}
        </button>

        {/* Desktop menu */}
        <div className="hidden md:flex gap-6">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`hover:underline ${
                pathname === href ? 'text-red-500' : ''
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile dropdown */}
      {isOpen && (
        <div className="md:hidden mt-3 flex flex-col gap-3">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`hover:underline px-3 py-1 rounded ${
                pathname === href ? 'bg-red-500 text-gray-900' : ''
              }`}
              onClick={() => setIsOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}