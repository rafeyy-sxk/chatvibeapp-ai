const { runCLI } = require("jest");
const fs = require("fs");
const path = require("path");

async function main() {
  const { results } = await runCLI(
    {
      runInBand: true,
      coverage: true,
      coverageDirectory: path.join(process.cwd(), "coverage"),
      reporters: ["default"],
    },
    [process.cwd()],
  );

  const summary = {
    suites: `${results.numPassedTestSuites}/${results.numTotalTestSuites}`,
    tests: `${results.numPassedTests}/${results.numTotalTests}`,
    success: results.success,
  };

  fs.mkdirSync(path.join(process.cwd(), "temp-jest"), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), "temp-jest", "results.json"), JSON.stringify(summary, null, 2), "utf8");

  if (results.coverageMap) {
    const json = results.coverageMap.toJSON();
    fs.writeFileSync(
      path.join(process.cwd(), "temp-jest", "coverage-map.json"),
      JSON.stringify(json, null, 2),
      "utf8",
    );
  }

  if (!results.success) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[jest] unhandled error", error);
  process.exitCode = 1;
});

