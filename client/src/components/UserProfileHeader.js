import { UserButton, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext'; // Import context
import { Sun, Moon } from 'lucide-react'; // Import icons

export default function UserProfileHeader() {
  const { user, isSignedIn } = useUser();
  const { theme, toggleTheme } = useTheme(); // Consume theme state
  const logoSrc = '/logo.png'; 

  const Logo = ({ onClick }) => (
  <div 
    className={`flex items-center p-1 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <img 
      src={logoSrc} 
      alt="Docsy Logo" 
      /* Removed dark:invert and mix-blend-multiply to preserve original colors */
      className="h-12 w-auto object-contain block transition-all duration-300" 
    />
  </div>
);

  const headerClasses = "flex items-center justify-between px-8 py-3 bg-[#f8f9fa] dark:bg-[#1A1A1A] border-b border-[#e9ecef] dark:border-gray-800 transition-colors duration-300";

  return (
    <div className={headerClasses}>
      <Logo onClick={() => window.location.href = '/dashboard'} />
      
      <div className="flex items-center gap-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-all duration-200 text-slate-ink dark:text-cool-grey"
          aria-label="Toggle Dark Mode"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-sun-yellow" />}
        </button>

        {isSignedIn && (
          <>
            <span className="text-sm text-[#666666] dark:text-cool-grey hidden sm:block">
              Welcome, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
            </span>
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10 border border-gray-200 dark:border-gray-700"
                }
              }}
            />
          </>
        )}
        
        {!isSignedIn && (
          <a href="/auth" className="text-sm text-[#3A86FF] font-medium hover:text-blue-600">
            Sign In
          </a>
        )}
      </div>
    </div>
  );
}