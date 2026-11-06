import { mountAggregator, showStartupError } from '../../src/composition';
void mountAggregator().catch(showStartupError);
