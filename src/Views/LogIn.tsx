    import { useState } from "react";
import LogInCard from "../Components/LogInCard";
import SignUpCard from "../Components/SignUpCard";
import ForgetPasswordCard from "../Components/ForgerPasswordCard";
import CheckYourEmailCard from "../Components/CheckYourEmail";
import LeftSide from "../Components/LeftSide";


function LogInSignUp() {
    const [isLogIn, setIsLogIn] = useState(true);
    const [isForgetPassword, setIsForgetPassword] = useState(false);
    const [isCheckYourEmail, setIsCheckYourEmail] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");

    const handleEmailSubmitted = (email: string) => {
        setSubmittedEmail(email);
        setIsCheckYourEmail(true);
        setIsForgetPassword(false);
    };

    const handleTryDifferentEmail = () => {
        setIsCheckYourEmail(false);
        setIsForgetPassword(true);
        setSubmittedEmail("");
    };

    const handleBackToLogin = () => {
        setIsCheckYourEmail(false);
        setIsForgetPassword(false);
    };

    return (
        <div className="flex flex-row min-h-screen w-screen m-0 p-0">
            <div className="bg-blue-600 flex-1 flex items-center justify-center">
                <LeftSide/>
            </div>
            <div className="bg-white flex-1 flex items-center justify-center">
                {isLogIn ? (
                    isCheckYourEmail ? (
                        <CheckYourEmailCard 
                            email={submittedEmail}
                            onBackToLogin={handleBackToLogin} 
                            onTryDifferentEmail={handleTryDifferentEmail} 
                        />
                    ) : isForgetPassword ? (
                        <ForgetPasswordCard 
                            onBack={() => setIsForgetPassword(false)} 
                            onEmailSubmitted={handleEmailSubmitted}
                        />
                    ) : (
                        <LogInCard 
                            onSignUp={() => setIsLogIn(false)} 
                            onForgot={() => setIsForgetPassword(true)} 
                        />
                    )
                ) : (
                    <SignUpCard onSwitch={() => setIsLogIn(true)} />
                )}
            </div>
        </div>
    );
}

export default LogInSignUp;