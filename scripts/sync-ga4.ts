import "./load-env";
import { closeDb } from "../src/lib/db";
import {
  syncGa4Reports,
  validateGa4Connection,
} from "../src/lib/analytics/collector";
import { publicErrorMessage } from "../src/lib/errors";

type CliOptions = {
  days?: number;
  startDate?: string;
  endDate?: string;
  validate: boolean;
  fixture: boolean;
  dryRun: boolean;
  help: boolean;
};

function printHelp() {
  console.log(`Sync GA4 reports into PostgreSQL.

Usage:
  pnpm ga4:sync [options]
  pnpm ga4:validate

Options:
  --days <n>          Number of complete days ending yesterday (default: 7)
  --start YYYY-MM-DD  Inclusive start date
  --end YYYY-MM-DD    Inclusive end date
  --validate          Check GA4 credentials without writing to Postgres
  --fixture           Load fixtures/ga4-sample.json instead of calling GA4
  --dry-run           Fetch and count rows without writing to Postgres
  --help              Show this message
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    validate: false,
    fixture: false,
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--days":
        options.days = Number(next);
        index += 1;
        break;
      case "--start":
        options.startDate = next;
        index += 1;
        break;
      case "--end":
        options.endDate = next;
        index += 1;
        break;
      case "--validate":
        options.validate = true;
        break;
      case "--fixture":
        options.fixture = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.validate) {
    const result = await validateGa4Connection({ fixture: options.fixture });
    console.log(`GA4 connection ok for property ${result.propertyId}.`);
    return;
  }

  const result = await syncGa4Reports({
    days: options.days,
    startDate: options.startDate,
    endDate: options.endDate,
    fixture: options.fixture,
    dryRun: options.dryRun,
  });

  console.log("GA4 → PostgreSQL sync");
  console.log(`Property: ${result.propertyId}`);
  console.log(`Range: ${result.range.startDate} → ${result.range.endDate}`);
  console.log(`Mode: ${result.mode}`);
  console.log("Upserted:");
  console.log(`  daily: ${result.counts.daily}`);
  console.log(`  pages: ${result.counts.pages}`);
  console.log(`  events: ${result.counts.events}`);
  console.log(`  trafficSources: ${result.counts.trafficSources}`);
}

main()
  .catch((error) => {
    console.error(publicErrorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
