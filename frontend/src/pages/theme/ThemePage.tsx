import { PageHeader } from '@/shared/ui/PageHeader';
import { BrandSection } from './sections/BrandSection';
import { ColourSection } from './sections/ColourSection';
import { ControlsSection } from './sections/ControlsSection';
import { IconsSection } from './sections/IconsSection';
import { LoadingSection } from './sections/LoadingSection';
import { MotionSection } from './sections/MotionSection';
import { SurfacesSection } from './sections/SurfacesSection';
import { TypeSection } from './sections/TypeSection';

/** The design system, in one place (plan 0002, frontend/DESIGN.md). */
export function ThemePage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Theme"
        description="The Gateway's colour, type, controls and motion. Switch the theme at the top right to see both."
      />
      <BrandSection />
      <ColourSection />
      <TypeSection />
      <ControlsSection />
      <SurfacesSection />
      <IconsSection />
      <LoadingSection />
      <MotionSection />
    </div>
  );
}
