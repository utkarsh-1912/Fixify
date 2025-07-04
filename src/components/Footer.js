// components/Footer.jsx
import Link from 'next/link';

const Footer = () => {
    const currentYear = new Date().getFullYear();
  return (
    <footer className="p-4 bg-gray-50">
      <div className="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-between">
        <span className="text-sm text-gray-500 sm:text-center">
          © {currentYear} <Link href="/" className="hover:underline">FIXify™</Link>. All Rights Reserved.
        </span>
        <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-gray-500 sm:mt-0">
          <li>
            <Link href="/about" className="hover:underline me-4 md:me-6">About</Link>
          </li>
          <li>
            <Link href="/privacy" className="hover:underline me-4 md:me-6">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
};

export default Footer;
