import { Mail, Key } from 'lucide-react';
import { useState } from 'react';

interface ForgetPasswordCardProps {
    onBack: () => void;
    onEmailSubmitted: (email: string) => void;
}

function ForgetPasswordCard({ onBack, onEmailSubmitted }: ForgetPasswordCardProps) {
    const [email, setEmail] = useState('');
    const [isValidEmail, setIsValidEmail] = useState(false);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmail(value);
        // Simple email validation
        setIsValidEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
    };

    const handleSubmit = () => {
        if (isValidEmail) {
            onEmailSubmitted(email);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-lg p-8 shadow-lg">
            {/* Back Button */}
            <div className="flex justify-start mb-5">
                <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); onBack(); }} 
                    className="text-gray-500 text-sm flex items-center gap-2 transition-colors hover:text-gray-900 cursor-pointer"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <span>Back to Login</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex flex-col items-center text-center">
                {/* Green Icon Box */}
                <div className="bg-emerald-100 w-16 h-16 rounded-lg flex justify-center items-center mb-6">
                    <Key size={32} className="text-emerald-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
                <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-sm">
                    Enter your email address and we'll send you instructions to reset your password
                </p>

                {/* Email Input Field */}
                <div className="w-full text-left mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <div className="flex items-center border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 transition-all focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-600">
                        <Mail size={20} className="mr-3 text-gray-400 opacity-50" />
                        <input 
                            type="email" 
                            placeholder="you@example.com" 
                            className="border-none outline-none flex-1 text-sm bg-transparent text-gray-900 placeholder-gray-400"
                            value={email}
                            onChange={handleEmailChange}
                        />
                    </div>
                </div>

                {/* Primary Action Button */}
                <button 
                    onClick={handleSubmit}
                    disabled={!isValidEmail}
                    className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg border-none cursor-pointer transition-colors mb-8 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    Send Reset Instructions
                </button>

                {/* Help Footer Box */}
                <div className="w-full bg-gray-100 rounded-lg p-4">
                    <p className="m-0 text-sm text-gray-600 font-medium">
                        Need help? Contact support at{' '}
                        <a href="mailto:support@dronemeshpro.com" className="text-emerald-600 no-underline font-medium hover:underline">
                            support@dronemeshpro.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ForgetPasswordCard;