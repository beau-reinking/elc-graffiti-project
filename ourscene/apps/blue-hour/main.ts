import { mountVenue, showStartupError } from '../../src/composition';
import { config } from './config';
void mountVenue(config).catch(showStartupError);
