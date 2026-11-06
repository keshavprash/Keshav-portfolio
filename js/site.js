/* Entry point. Interface first; the stage (2D or 3D) never blocks reading or navigation. */
import { initNavigation } from './ui/navigation.js';
import { initInteractions } from './ui/interactions.js';
import { initScrollStory } from './ui/scroll-story.js';
import { bootStage } from './3d/stage.js';

function boot() {
  initNavigation();
  initInteractions();
  initScrollStory();
  bootStage().catch((e) => console.warn('Stage could not start.', e));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
