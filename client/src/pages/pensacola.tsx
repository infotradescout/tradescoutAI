import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  PENSACOLA_DISCOVERY,
  PENSACOLA_PROJECTS,
  pensacolaProjectMessage,
  type PensacolaProjectKind,
} from "@shared/pensacolaDiscovery";
import PensacolaContent from "./pensacola-content";

const ExpressDirectConnectPanel = lazy(() => import("./profile-sites/ExpressDirectConnectPanel"));

export default function PensacolaPage() {
  const [requestKind, setRequestKind] = useState<PensacolaProjectKind | null>(null);
  const { user, isAuthenticated } = useAuth();
  return (
    <>
      <SEOHelmet
        title={PENSACOLA_DISCOVERY.title}
        description={PENSACOLA_DISCOVERY.description}
        canonical="https://www.thetradescout.com/pensacola"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: PENSACOLA_DISCOVERY.title,
              description: PENSACOLA_DISCOVERY.description,
              url: "https://www.thetradescout.com/pensacola",
            },
            createBreadcrumbStructuredData([
              { name: "TradeScout", url: "/" },
              { name: "Pensacola", url: "/pensacola" },
            ]),
            createFAQStructuredData([...PENSACOLA_DISCOVERY.faqItems]),
          ],
        }}
      />
      <PensacolaContent onStartRequest={setRequestKind} />
      {requestKind ? (
        <Suspense
          fallback={
            <p role="status" className="p-4 text-white">
              Opening your ISSA Build request…
            </p>
          }
        >
          <ExpressDirectConnectPanel
            open
            onClose={() => setRequestKind(null)}
            profileSlug={PENSACOLA_DISCOVERY.profileSlug}
            businessName="ISSA Build"
            hasViewerSession={isAuthenticated || Boolean(user?.id)}
            allowCall={false}
            requestMode="service"
            initialServiceName={PENSACOLA_PROJECTS[requestKind].title}
            initialMessage={pensacolaProjectMessage(requestKind)}
            initialView="request"
            initialRequestType="request_service"
            contactOperatorName="TradeScout"
            contactOperatorRole="ISSA Build inquiries"
            deliveryCustody="tradescout_pending_owner"
            stayInProfile
          />
        </Suspense>
      ) : null}
    </>
  );
}
