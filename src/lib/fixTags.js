// Common FIX tag → description maps
export const FIX_TAGS = {
  8: "BeginString",
  9: "BodyLength",
  35: "MsgType",
  34: "MsgSeqNum",
  49: "SenderCompID",
  56: "TargetCompID",
  52: "SendingTime",
  11: "ClOrdID",
  55: "Symbol",
  54: "Side",
  38: "OrderQty",
  40: "OrdType",
  59: "TimeInForce",
  60: "TransactTime",
  58: "Text",
};

// Value mappings for some fields
export const FIX_VALUES = {
  35: {
    D: "New Order Single",
    8: "Execution Report",
    F: "Order Cancel Request",
  },
  54: {
    1: "Buy",
    2: "Sell",
  },
  40: {
    1: "Market",
    2: "Limit",
  },
  59: {
    0: "Day",
    1: "Good Till Cancel",
    3: "Immediate Or Cancel",
  },
};
