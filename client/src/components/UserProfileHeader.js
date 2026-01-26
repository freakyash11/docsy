import { UserButton, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function UserProfileHeader() {
  const { user, isSignedIn } = useUser();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const logoSrc = '/logo.png'; 

  const Logo = () => (
    <div 
      className="flex items-center p-1 cursor-pointer"
      onClick={() => navigate('/dashboard')}
    >
      <img 
        src={logoSrc} 
        alt="Docsy Logo" 
        className="h-12 w-auto object-contain block dark:invert transition-all duration-300" 
      />
    </div>
  );

  return (
    <div className="flex items-center justify-between px-8 py-3 bg-[#f8f9fa] dark:bg-[#1A1A1A] border-b border-[#e9ecef] dark:border-gray-800 transition-colors duration-300">
      <Logo />
      
      <div className="flex items-center gap-4">
        {/* FIX: Only show toggle if user is signed in */}
        {isSignedIn && (
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200"
            aria-label="Toggle Dark Mode"
          >
            {theme === 'light' ? <Moon className="w-5 h-5 text-slate-ink" /> : <Sun className="w-5 h-5 text-sun-yellow" />}
          </button>
        )}

        {isSignedIn ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#666666] dark:text-cool-grey hidden sm:block">
              Welcome, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
            </span>
            <UserButton appearance={{ elements: { avatarBox: "w-10 h-10" } }} />
          </div>
        ) : (
          <Link 
            to="/auth" 
            className="text-sm text-[#3A86FF] font-medium hover:text-blue-600 transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}