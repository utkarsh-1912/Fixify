// Sample schemas + payloads for the Binary Decoder. Payloads are generated with
// the same encoders the app ships (see tests/binaryCodec.test.js), so every
// preset decodes without warnings.

const SBE_CME_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://www.fixprotocol.org/ns/simple/1.0"
                   package="mktdata" id="1" version="3"
                   semanticVersion="1.0" byteOrder="littleEndian">
  <types>
    <enum name="Side" encodingType="uint8">
      <validValue name="Buy">1</validValue>
      <validValue name="Sell">2</validValue>
      <validValue name="Cross">3</validValue>
    </enum>
  </types>

  <!-- CME-style New Order: offsets are contiguous, blockLength covers every field -->
  <message id="101" name="NewOrderSingle" blockLength="41">
    <field name="MsgSeqNum" id="34" type="uint32" offset="0"/>
    <field name="SendingTime" id="52" type="uint64" offset="4"/>
    <field name="ClOrdID" id="11" type="uint64" offset="12"/>
    <field name="SecurityID" id="48" type="uint64" offset="20"/>
    <field name="Price" id="44" type="int64" offset="28"/>
    <field name="OrderQty" id="38" type="uint32" offset="36"/>
    <field name="Side" id="54" type="Side" offset="40"/>
  </message>
</sbe:messageSchema>`;

const SBE_B3_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://www.fixprotocol.org/ns/simple/1.0"
                   package="b3" id="2" version="1"
                   semanticVersion="1.0" byteOrder="littleEndian">
  <types>
    <type name="Symbol" primitiveType="char" length="8"/>
    <enum name="OrderStatus" encodingType="uint8">
      <validValue name="New">0</validValue>
      <validValue name="PartiallyFilled">1</validValue>
      <validValue name="Filled">2</validValue>
    </enum>
  </types>

  <message id="15" name="ExecutionReport" blockLength="25">
    <field name="OrderID" id="37" type="uint64" offset="0"/>
    <field name="CumQty" id="14" type="uint64" offset="8"/>
    <field name="OrdStatus" id="39" type="OrderStatus" offset="16"/>
    <field name="Symbol" id="55" type="Symbol" offset="17"/>
  </message>
</sbe:messageSchema>`;

const FAST_OPRA_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<templates xmlns="http://www.fixprotocol.org/ns/fast/td/1.1">
  <template name="OPRATrade" id="202">
    <!-- Operators (copy / default / increment) consume one presence-map bit each.
         The first PMap bit signals whether the template id is present in the stream. -->
    <uInt32 name="MsgSeqNum" id="34">
      <increment/>
    </uInt32>
    <string name="SendingTime" id="52"/>
    <string name="Symbol" id="55">
      <copy/>
    </string>
    <uInt32 name="BidPrice" id="270"/>
    <uInt32 name="BidSize" id="271">
      <default value="100"/>
    </uInt32>
  </template>
</templates>`;

export const PRESET_SAMPLE_VALUES = {
  sbe_cme: { MsgSeqNum: '1', SendingTime: '1752667200000000000', ClOrdID: '1001', SecurityID: '5001', Price: '15025', OrderQty: '100', Side: 'Buy' },
  sbe_b3: { OrderID: '123', CumQty: '1000', OrdStatus: 'Filled', Symbol: 'WTRADE1' },
  fast_opra: { MsgSeqNum: '7', SendingTime: '20260716-01:16:14', Symbol: 'AAPL', BidPrice: '18250', BidSize: '100' },
};

export const PRESETS = {
  sbe_cme: {
    name: 'CME MDP 3.0 (SBE)',
    encoding: 'sbe',
    payload: '29006500010003000100000000807A4988B95218E9030000000000008913000000000000B13A0000000000006400000001',
    schema: SBE_CME_SCHEMA,
  },
  sbe_b3: {
    name: 'B3 Brazil (SBE)',
    encoding: 'sbe',
    payload: '19000F00020001007B00000000000000E803000000000000025754524144453100',
    schema: SBE_B3_SCHEMA,
  },
  fast_opra: {
    name: 'OPRA Options Feed (FAST)',
    encoding: 'fast',
    payload: 'F001CA8732303236303731362D30313A31363A31B4414150CC010ECA',
    schema: FAST_OPRA_SCHEMA,
  },
  fix_logon: {
    name: 'FIX Logon (ASCII Hex)',
    encoding: 'ascii_hex',
    payload: '383D4649582E342E3401393D36370133353D410134393D434C49454E540135363D5345525645520133343D310135323D32303236303731362D30313A31363A31342E3030300139383D30013130383D33300131303D31343201',
    schema: '',
  },
  fix_nos: {
    name: 'FIX Order (ASCII Hex)',
    encoding: 'ascii_hex',
    payload: '383D4649582E342E3401393D3133320133353D440134393D434C49454E540135363D5345525645520133343D320135323D32303236303731362D30313A32303A30302E3030300131313D4F52445F313030310132313D310133383D3130300134303D320134343D3135302E30300135343D310135353D4141504C0136303D32303236303731362D30313A32303A30302E3030300131303D30363801',
    schema: '',
  },
};
