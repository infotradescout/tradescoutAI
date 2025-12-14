import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FacebookSignup } from "./FacebookSignup";
import { RoleSelection } from "./RoleSelection";
import { OnboardingFlow } from "./OnboardingFlow";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type AuthFlowStep = 'facebook-signup' | 'role-selection' | 'onboarding' | 'complete';

interface AuthFlowProps {
  onComplete: () => void;
  initialType?: 'homeowner' | 'professional';
}

export function AuthFlow({ onComplete, initialType }: AuthFlowProps) {
  const [currentStep, setCurrentStep] = useState<AuthFlowStep>('facebook-signup');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    name?: string;
    email?: string;
    profileImage?: string;
  } | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is already authenticated and needs role selection
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check if user has completed role selection
      if (!user.role || user.role === 'pending') {
        setCurrentStep('role-selection');
        setUserInfo({
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
          email: user.email,
          profileImage: user.profileImageUrl
        });
      } else if (!user.onboardingCompleted) {
        setCurrentStep('onboarding');
        setSelectedRole(user.role);
        setUserInfo({
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
          email: user.email,
          profileImage: user.profileImageUrl
        });
      } else {
        onComplete();
      }
    }
  }, [isAuthenticated, user, onComplete]);

  const handleFacebookSignup = () => {
    // This will redirect to Facebook OAuth
    window.location.href = '/api/auth/facebook';
  };

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await fetch('/api/auth/update-role', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const handleRoleSelect = async (role: string) => {
    try {
      setSelectedRole(role);
      await updateRoleMutation.mutateAsync(role);

      toast({
        title: "Role Selected",
        description: `Welcome to TradeScout as a ${role}!`,
        variant: "default",
      });

      setCurrentStep('onboarding');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        title: "Error",
        description: "Failed to save your role selection. Please try again.",
        variant: "destructive",
      });
    }
  };

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to complete onboarding');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const handleOnboardingComplete = async (formData: any) => {
    try {
      await completeOnboardingMutation.mutateAsync({
        ...formData,
        role: selectedRole
      });

      toast({
        title: "Welcome to TradeScout!",
        description: selectedRole === 'homeowner' 
          ? "You can start browsing contractors. Remember to complete verification to write recommendations."
          : "Your profile is under review. You'll be notified when you're approved for the contractor board.",
        variant: "default",
      });

      onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    }
  };

  const skipOnboardingMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await fetch('/api/auth/skip-onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to skip onboarding');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const handleSkipOnboarding = async () => {
    try {
      if (!selectedRole) return;
      await skipOnboardingMutation.mutateAsync(selectedRole);

      toast({
        title: "Account Created",
        description: "You can complete your profile anytime in account settings.",
        variant: "default",
      });

      onComplete();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Render based on current step
  switch (currentStep) {
    case 'facebook-signup':
      return (
        <FacebookSignup 
          onFacebookSignup={handleFacebookSignup}
        />
      );

    case 'role-selection':
      return (
        <RoleSelection 
          onRoleSelect={handleRoleSelect}
          userInfo={userInfo || undefined}
          initialType={initialType}
        />
      );

    case 'onboarding':
      if (!selectedRole) return null;
      const onboardingRole = (selectedRole === 'homeowner' ? 'homeowner' : 'contractor') as 'homeowner' | 'contractor';
      return (
        <OnboardingFlow
          role={onboardingRole}
          userInfo={userInfo || {}}
          onComplete={handleOnboardingComplete}
          onSkip={handleSkipOnboarding}
        />
      );

    default:
      return null;
  }
}