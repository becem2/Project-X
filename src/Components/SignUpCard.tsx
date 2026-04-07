import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock, User, Building2 } from 'lucide-react';

import Button from "./SocialLogInButtons";
import {auth,facebookProvider,githubProvider,googleProvider} from '../Config/Firebase'
import {signInWithPopup} from 'firebase/auth'

function SignUpCard({ onSwitch }: { onSwitch: () => void }) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        console.log("Form submitted successfully!");
    };

    const signInWithFacebook = async () => {
        try{
            await signInWithPopup(auth,facebookProvider);
        }
        catch(error){
            console.log(error);
        }
    }

    const signInWithApple = async () => {
        try{
            await signInWithPopup(auth,googleProvider);
        }
        catch(error){
            console.log(error);
        }
    }

    const signInWithGithub = async () => {
        try{
            await signInWithPopup(auth,githubProvider);
        }
        catch(error){
            console.log(error);
        }
    }

    const signInWithGoogle = async () => {
        try{
            await signInWithPopup(auth,googleProvider);
        }
        catch(error){
            console.log(error);
        }
    }

    return (
        <div className="bg-white rounded-2xl p-10 w-3/5 min-w-96 h-auto shadow-lg text-left">
            <h1 className="text-2xl font-bold mb-1">Create Your Account</h1>
            <h2 className="text-sm text-gray-600 mb-6">Join DroneMesh Pro for professional photogrammetry</h2>
            
            {/* Social Buttons Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
                <Button text="Google" onClick={signInWithGoogle}/>
                <Button text="Facebook" onClick={signInWithFacebook}/>
                <Button text="Apple" onClick={signInWithApple}/>
                <Button text="Github" onClick={signInWithGithub}/>
            </div>

            {/* Separator */}
            <div className="flex items-center text-xs text-gray-400 my-5">
                <span className="flex-1 h-px bg-gray-300"></span>
                <span className="px-3">Or continue with email</span>
                <span className="flex-1 h-px bg-gray-300"></span>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {/* First and Last Name Row */}
                <div className="flex gap-5 w-full">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white transition-all duration-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-inset">
                            <User size={20} className="mr-3 text-gray-400" />
                            <input type="text" placeholder="Jeffery" className="border-none outline-none flex-1 text-sm w-full" required/>
                        </div>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white transition-all duration-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-inset">
                            <User size={20} className="mr-3 text-gray-400" />
                            <input type="text" placeholder="Epstein" className="border-none outline-none flex-1 text-sm w-full" required/>
                        </div>
                    </div>
                </div>

                {/* Organization */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white transition-all duration-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-inset">
                        <Building2 size={20} className="mr-3 text-gray-400" />
                        <input type="text" placeholder="National School of Engineering" className="border-none outline-none flex-1 text-sm w-full" required />
                    </div>
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white transition-all duration-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-inset">
                        <Mail size={20} className="mr-3 text-gray-400" />
                        <input type="email" placeholder="you@example.com" className="border-none outline-none flex-1 text-sm w-full" required />
                    </div>
                </div>

                {/* Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-white transition-all duration-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-inset">
                        <Lock size={20} className="mr-3 text-gray-400" />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Enter your password" 
                            className="border-none outline-none flex-1 text-sm w-full" 
                            required
                            value={password}
                            onChange={(e)=>setPassword(e.target.value)}
                        />
                        <div className="flex items-center cursor-pointer ml-2" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff size={20} className="text-gray-400" /> : <Eye size={20} className="text-gray-400" />}
                        </div>
                    </div>
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className={`flex items-center border rounded-lg px-3 py-2 bg-white transition-colors ${password !== confirmPassword && confirmPassword ? 'border-red-500' : 'border-gray-300'}`}>
                        <Lock size={20} className="mr-3 text-gray-400" />
                        <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="Confirm your password" 
                            className="border-none outline-none flex-1 text-sm w-full" 
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <div className="flex items-center cursor-pointer ml-2" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                            {showConfirmPassword ? <EyeOff size={20} className="text-gray-400" /> : <Eye size={20} className="text-gray-400" />}
                        </div>
                    </div>
                </div>

                {/* Terms and Services */}
                <div className="flex items-start gap-2 my-1">
                    <input type="checkbox" className="mt-0.5" />
                    <label className="text-xs text-gray-600">
                        I agree to the <a href="#" className="text-emerald-600 no-underline font-medium">Terms of Service</a> and <a href="#" className="text-emerald-600 no-underline font-medium">Privacy Policy</a>
                    </label>
                </div>

                <button type="submit" className="w-full bg-emerald-600 text-white font-bold p-3 rounded-lg border-none cursor-pointer transition-colors hover:bg-emerald-700 mt-2">
                    Sign Up
                </button>
            </form>

            <p className="text-xs text-center text-gray-600 mt-6">
                Already have an account? <a href="#" onClick={onSwitch} className="text-emerald-600 no-underline font-semibold">Sign in</a>
            </p>
            <p className="text-xs text-gray-400 text-center mt-7">© 2026 DroneMesh Pro. All rights reserved.</p>
        </div>
    );
}

export default SignUpCard;