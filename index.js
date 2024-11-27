const talib = require("talib");
const dfd = require("danfojs-node");
const path = require("path");

const calculateIndicators = async (df) => {
  const high = df["high"].values;
  const low = df["low"].values;
  const close = df["close"].values;

  console.log("OHLCV Data Loaded:");
  const closePrices = df["close"].values.map((price) => parseFloat(price));
  console.log("Close Prices:", closePrices.length);
  const optionsBbands = {
    name: "BBANDS",
    startIdx: 0,
    endIdx: closePrices.length - 1,
    inReal: closePrices,
    optInTimePeriod: 20, // Period for moving average
    optInNbDevUp: 2, // Standard deviation multiplier for upper band
    optInNbDevDn: 2, // Standard deviation multiplier for lower band
    optInMAType: 0, // Moving average type (0 = SMA)
  };

  talib.execute(optionsBbands, (err, result) => {
    if (err) {
      console.error("Error in BBANDS calculation:", err);
    } else {
      const padding = new Array(19 /* Period */).fill(null);
      const alignedUpperBand = [...padding, ...result.result.outRealUpperBand];
      const alignedMiddleBand = [
        ...padding,
        ...result.result.outRealMiddleBand,
      ];
      const alignedLowerBand = [...padding, ...result.result.outRealLowerBand];
      df.addColumn("upper_band", alignedUpperBand, { inplace: true });
      df.addColumn("middle_band", alignedMiddleBand, { inplace: true });
      df.addColumn("lower_band", alignedLowerBand, { inplace: true });
      console.log("Column added successfully.");
      console.log("BBANDS Column:");
      df.print();
      //   dfd.toCSV(df, { filePath, encoding: "utf8" });
    }
  });

  let options = {
    name: "RSI",
    startIdx: 0,
    endIdx: closePrices.length - 1,
    inReal: closePrices, // Pass the close prices
    optInTimePeriod: 14, // Typical RSI time period
  };
  await talib.execute(options, async (err, result) => {
    if (err) {
      console.error("Error calculating RSI:", err);
    } else {
      const filePath = path.resolve(__dirname, "node_btc_BBRSI.csv");
      const padding = Array(
        closePrices.length - result.result.outReal.length
      ).fill(null);
      const alignedRSI = [...padding, ...result.result.outReal];
      try {
        df.addColumn("rsi", alignedRSI, { inplace: true });
        df.print({ maxRows: 10000 });
        // dfd.toCSV(df, { filePath, encoding: "utf8" });
      } catch (error) {
        console.error("Error adding column:", error);
      }
    }
  });

  /**
   *  def calculate_indicators(self, df):
        # Calculate Ichimoku Cloud components
        df["tenkan_sen"] = (
            ta.MAX(df["high"], timeperiod=9) + ta.MIN(df["low"], timeperiod=9)
        ) / 2
        df["kijun_sen"] = (
            ta.MAX(df["high"], timeperiod=26) + ta.MIN(df["low"], timeperiod=26)
        ) / 2
        df["senkou_span_a"] = ((df["tenkan_sen"] + df["kijun_sen"]) / 2).shift(26)
        df["senkou_span_b"] = (
            ta.MAX(df["high"], timeperiod=52) + ta.MIN(df["low"], timeperiod=52)
        ) / 2
        df["chikou_span"] = df["close"].shift(-26)
        return df

   */

  // Calculate Tenkan-sen
  const tenkanOptions = {
    name: "MAX",
    startIdx: 0,
    endIdx: high.length - 1,
    inReal: high,
    optInTimePeriod: 9,
  };

  const tenkanMax = await new Promise((resolve, reject) => {
    talib.execute(tenkanOptions, (err, result) => {
      if (err) reject(err);
      else resolve(result.result.outReal);
    });
  });

  const tenkanMin = await new Promise((resolve, reject) => {
    talib.execute(
      { ...tenkanOptions, name: "MIN", inReal: low },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.result.outReal);
      }
    );
  });

  let tenkanSen = tenkanMax.map((maxVal, i) => (maxVal + tenkanMin[i]) / 2);

  // Calculate Kijun-sen
  const kijunMax = await new Promise((resolve, reject) => {
    talib.execute(
      { ...tenkanOptions, optInTimePeriod: 26, inReal: high },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.result.outReal);
      }
    );
  });

  const kijunMin = await new Promise((resolve, reject) => {
    talib.execute(
      { ...tenkanOptions, optInTimePeriod: 26, name: "MIN", inReal: low },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.result.outReal);
      }
    );
  });

  let kijunSen = kijunMax.map((maxVal, i) => (maxVal + kijunMin[i]) / 2);

  // Calculate Senkou Span A
  let senkouSpanA = tenkanSen.map((tenkan, i) =>
    kijunSen[i] !== undefined ? (tenkan + kijunSen[i]) / 2 : null
  );
  senkouSpanA.unshift(...Array(26).fill(null)); // Shift Senkou Span A forward by 26 periods

  // Calculate Senkou Span B
  const senkouMax = await new Promise((resolve, reject) => {
    talib.execute(
      { ...tenkanOptions, optInTimePeriod: 52, inReal: high },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.result.outReal);
      }
    );
  });

  const senkouMin = await new Promise((resolve, reject) => {
    talib.execute(
      { ...tenkanOptions, optInTimePeriod: 52, name: "MIN", inReal: low },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.result.outReal);
      }
    );
  });

  let senkouSpanB = senkouMax.map((maxVal, i) =>
    senkouMin[i] !== undefined ? (maxVal + senkouMin[i]) / 2 : null
  );
  senkouSpanB.unshift(...Array(26).fill(null)); // Shift Senkou Span B forward by 26 periods

  // Calculate Chikou Span
  let chikouSpan = close.map((val, i) => close[i - 26] || null);
  tenkanSen = padToLength(tenkanSen, df.shape[0]);
  kijunSen = padToLength(kijunSen, df.shape[0]);
  senkouSpanA = padToLength(senkouSpanA, df.shape[0]);
  senkouSpanB = padToLength(senkouSpanB, df.shape[0]);
  chikouSpan = padToLength(chikouSpan, df.shape[0]);
  // Add the calculated indicators to the DataFrame
  df.addColumn("tenkan_sen", tenkanSen, { inplace: true });
  console.log("Column added successfully. TENKAN SEN Column:");
  df.print();

  df.addColumn("kijun_sen", kijunSen, { inplace: true });
  console.log("Column added successfully. KIJUN SEN Column:");
  df.print();

  //   df.addColumn("senkou_span_a", senkouSpanA, { inplace: true });
  //   console.log("Column added successfully. SENKOU SPAN A Column:");
  //   df.print();

  df.addColumn("senkou_span_b", senkouSpanB, { inplace: true });
  console.log("Column added successfully. SENKOU SPAN B Column:");
  df.print();

  df.addColumn("chikou_span", chikouSpan, { inplace: true });
  console.log("Column added successfully. CHIKOU SPAN Column:");
  df.print();

  return df;
};
dfd.readCSV("./btc_18_22_3m.csv").then(async (df) => {
  let resCsv = await calculateIndicators(df);
  dfd.toCSV(resCsv, { filePath: "./node_btc_18_22_3m_indicators.csv" });
});

const padToLength = (arr, totalLength) => {
  console.log({ totalLength, arrLen: arr.length });
  const padding = Array(Math.max(0, totalLength - arr.length)).fill(null);
  if (padding.length === 0) return arr;
  return (arr = [...padding, ...arr]);
};
