const talib = require("talib");
const dfd = require("danfojs-node");
const path = require("path");
class Strategy {
  // Main method to run the strategy
  run = async (df) => {
    try {
      df = await this.calculateIndicators(df);
      console.log("Final DataFrame:");
      df.print();
      return df;
    } catch (error) {
      console.error("Error running strategy:", error);
    }
  };

  // Wrapper for Talib execution to return a promise
  executeTalib = (options) => {
    return new Promise((resolve, reject) => {
      talib.execute(options, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  // Method to calculate indicators
  calculateIndicators = async (df) => {
    try {
      const closePrices = df["close"].values.map((price) => parseFloat(price));
      console.log("OHLCV Data Loaded:");
      console.log("Close Prices:", closePrices.length);

      // BBANDS calculation
      const optionsBbands = {
        name: "BBANDS",
        startIdx: 0,
        endIdx: closePrices.length - 1,
        inReal: closePrices,
        optInTimePeriod: 20,
        optInNbDevUp: 2,
        optInNbDevDn: 2,
        optInMAType: 0,
      };

      const bbandsResult = await this.executeTalib(optionsBbands);
      const padding = new Array(19).fill(null);
      const alignedUpperBand = [
        ...padding,
        ...bbandsResult.result.outRealUpperBand,
      ];
      const alignedMiddleBand = [
        ...padding,
        ...bbandsResult.result.outRealMiddleBand,
      ];
      const alignedLowerBand = [
        ...padding,
        ...bbandsResult.result.outRealLowerBand,
      ];
      df.addColumn("upper_band", alignedUpperBand, { inplace: true });
      df.addColumn("middle_band", alignedMiddleBand, { inplace: true });
      df.addColumn("lower_band", alignedLowerBand, { inplace: true });

      // RSI calculation
      const optionsRsi = {
        name: "RSI",
        startIdx: 0,
        endIdx: closePrices.length - 1,
        inReal: closePrices,
        optInTimePeriod: 14,
      };

      const rsiResult = await this.executeTalib(optionsRsi);
      const rsiPadding = Array(
        closePrices.length - rsiResult.result.outReal.length
      ).fill(null);
      const alignedRSI = [...rsiPadding, ...rsiResult.result.outReal];
      df.addColumn("rsi", alignedRSI, { inplace: true });

      console.log("Indicators calculated successfully.");
      return df;
    } catch (error) {
      console.error("Error in calculateIndicators:", error);
      throw error;
    }
  };
}

// Instantiate and run the strategy
// const str = new Strategy();

// (async () => {
//   try {
//     // Read the CSV file asynchronously
//     const df = await dfd.readCSV("./btc_18_22_3m.csv");
//     await str.run(df);
//   } catch (error) {
//     console.error("Error reading CSV or running strategy:", error);
//   }
// })();
