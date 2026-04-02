import { useEffect } from 'react';
import { useTutorialContext } from './TutorialProvider';

interface FeatureTutorialTriggerProps {
  featureId: string;
  children: React.ReactNode;
  triggerOnMount?: boolean;
  triggerOnClick?: boolean;
}

export function FeatureTutorialTrigger({
  featureId,
  children,
  triggerOnMount = false,
  triggerOnClick = false,
}: FeatureTutorialTriggerProps) {
  const { checkFeatureTutorial } = useTutorialContext();

  useEffect(() => {
    if (triggerOnMount) {
      checkFeatureTutorial(featureId);
    }
  }, [featureId, triggerOnMount, checkFeatureTutorial]);

  const handleClick = () => {
    if (triggerOnClick) {
      checkFeatureTutorial(featureId);
    }
  };

  return (
    <div 
      data-tutorial={featureId}
      onClick={triggerOnClick ? handleClick : undefined}
    >
      {children}
    </div>
  );
}