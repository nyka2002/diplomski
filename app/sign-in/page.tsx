import { Suspense } from "react";
import SignInView from "@/components/views/SignInView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignInView />
    </Suspense>
  );
}
