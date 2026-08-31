'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineSelect } from '@/components/common/InlineSelect';
import { Printer, Loader2, Download, RefreshCw } from 'lucide-react';

interface BankTransaction {
  id: string;
  ledger: string;
  debit_amount: number;
  credit_amount: number;
  transaction_date: string;
  party?: { name: string; address?: string };
  project?: { name: string };
  account?: { account_name: string; account_number: string; bank_name: string; ifsc_code?: string };
}

interface ChequeData {
  id: string;
  transaction_date: string;
  debit_amount: number;
  party_name: string;
  party_address: string;
  project_name: string;
  reference: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  ifsc_code: string;
  ledger: string;
}

const formatAmountInWords = (num: number): string => {
  if (num === 0) return 'Zero';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  return result;
};

const formatIndianDate = (dateStr: string): string => {
  if (!dateStr) return '          ';
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, ' ');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[date.getMonth()];
  const year = date.getFullYear().toString();
  return `${day}  ${month}  ${year}`;
};

const formatAccountNumber = (accNo: string): string => {
  if (!accNo) return '              ';
  return accNo.toString().padEnd(17, ' ').split('').join('  ');
};

interface SBIChequeProps {
  chequeData: ChequeData | null;
  customFields: {
    payee_name: string;
    amount: string;
    date: string;
    amount_words: string;
    account_payee_only: boolean;
    crossed: boolean;
  };
}

function SBICheque({ chequeData, customFields }: SBIChequeProps) {
  const amount = parseFloat(customFields.amount) || 0;
  const amountStr = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div 
      id="sbi-cheque-preview"
      className="sbi-cheque"
      style={{
        width: '9in',
        height: '3.85in',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header with Bank Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '8px 15px 5px 15px',
        borderBottom: '1px solid #ddd',
        height: '45px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* SBI Logo placeholder */}
          <div style={{
            width: '35px',
            height: '35px',
            backgroundColor: '#1a5f7a',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 'bold',
          }}>
            <span>SBI</span>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#1a5f7a' }}>
              STATE BANK OF INDIA
            </div>
            <div style={{ fontSize: '7px', color: '#666' }}>
              {chequeData?.bank_name || 'Commercial Branch'}
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '2px' }}>IFSC: {chequeData?.ifsc_code || 'SBIN0000000'}</div>
          <div style={{ 
            border: '1px solid #333', 
            padding: '2px 8px', 
            fontSize: '10px',
            fontFamily: 'Courier New, monospace',
          }}>
            {formatAccountNumber(chequeData?.account_number || '')}
          </div>
          <div style={{ fontSize: '7px', color: '#666', marginTop: '2px' }}>A/C NO.</div>
        </div>
      </div>

      {/* Date and Check boxes */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 15px',
        height: '35px',
      }}>
        <div style={{ fontSize: '8px', color: '#666' }}>A/c Payee Only</div>
        
        {/* Date Field */}
        <div style={{ 
          border: '1px solid #333', 
          padding: '3px 10px',
          minWidth: '150px',
          textAlign: 'center',
          backgroundColor: '#f9f9f9',
        }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '1px' }}>Date</div>
          <div style={{ fontSize: '11px', fontFamily: 'Courier New, monospace', letterSpacing: '1px' }}>
            {formatIndianDate(customFields.date)}
          </div>
        </div>
      </div>

      {/* Payee Name */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 15px',
        gap: '10px',
      }}>
        <span style={{ fontSize: '8px', color: '#666', width: '50px' }}>Pay</span>
        <div style={{ 
          flex: 1,
          borderBottom: '1px solid #333',
          paddingBottom: '2px',
        }}>
          <div style={{ fontSize: '7px', color: '#999', marginBottom: '1px' }}>Pay to (Name of the Payee)</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {customFields.payee_name || '                                                         '}
          </div>
        </div>
      </div>

      {/* Amount in Figures */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 15px',
        gap: '10px',
      }}>
        <span style={{ fontSize: '8px', color: '#666', width: '50px' }}>Rupees</span>
        <div style={{ 
          flex: 1,
          borderBottom: '1px solid #333',
          paddingBottom: '2px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '5px',
        }}>
          <span style={{ fontSize: '8px', color: '#999' }}>Rs.</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'Courier New, monospace' }}>
            {amount > 0 ? `₹ ${amountStr}` : '                                                                 '}
          </span>
        </div>
      </div>

      {/* Amount in Words */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '5px 15px',
        gap: '10px',
        borderBottom: '1px solid #333',
      }}>
        <span style={{ fontSize: '8px', color: '#666', width: '50px', marginTop: '2px' }}>In Words</span>
        <div style={{ 
          flex: 1,
          minHeight: '30px',
          paddingBottom: '3px',
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 'bold', 
            textTransform: 'uppercase',
            lineHeight: '1.3',
            wordBreak: 'break-word',
          }}>
            {customFields.amount_words || '                                                                                                 '}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '8px 15px 5px 15px',
        height: '55px',
      }}>
        {/* Left side - Crossed info */}
        <div style={{ fontSize: '8px', color: '#666' }}>
          {customFields.crossed && (
            <div style={{ marginBottom: '3px' }}>
              <span style={{ textDecoration: 'line-through', fontWeight: 'bold' }}>__________</span>
              <span style={{ marginLeft: '10px' }}>A/c Payee Only</span>
            </div>
          )}
          <div style={{ color: '#999' }}>
            {customFields.crossed ? 'Crossed' : 'Or Bearer'}
          </div>
        </div>

        {/* Right side - Signature */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            width: '140px',
            borderTop: '1px solid #333',
            paddingTop: '3px',
            fontSize: '7px',
            color: '#666',
          }}>
            Signature
          </div>
        </div>
      </div>

      {/* MICR Band at bottom */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '25px',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 15px',
        gap: '20px',
        borderTop: '1px solid #ddd',
      }}>
        <div style={{ fontSize: '7px', color: '#666' }}>
          <span style={{ fontWeight: 'bold' }}>CHEQUE SERIAL:</span> {chequeData?.reference || '000000'}
        </div>
        <div style={{ fontSize: '7px', color: '#999', flex: 1, textAlign: 'center' }}>
          {chequeData?.account_number || ''}
        </div>
        <div style={{ 
          fontFamily: 'OCR-A, Courier New, monospace',
          fontSize: '9px',
          color: '#333',
          letterSpacing: '2px',
        }}>
          MICR ENCODED
        </div>
      </div>

      {/* Watermark */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '60px',
        color: 'rgba(26, 95, 122, 0.03)',
        fontWeight: 'bold',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        STATE BANK OF INDIA
      </div>
    </div>
  );
}

interface HdfcChequeProps extends SBIChequeProps {}

function HdfcCheque({ chequeData, customFields }: HdfcChequeProps) {
  const amount = parseFloat(customFields.amount) || 0;
  const amountStr = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div 
      id="hdfc-cheque-preview"
      className="hdfc-cheque"
      style={{
        width: '9in',
        height: '3.85in',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '10px 20px 8px 20px',
        borderBottom: '2px solid #004c8f',
        height: '50px',
        background: 'linear-gradient(to bottom, #fff, #f8f8f8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '50px',
            height: '35px',
            backgroundColor: '#004c8f',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '8px',
            fontWeight: 'bold',
          }}>
            HDFC BANK
          </div>
          <div style={{ borderLeft: '2px solid #004c8f', paddingLeft: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#004c8f' }}>
              HDFC BANK LIMITED
            </div>
            <div style={{ fontSize: '7px', color: '#666' }}>
              {chequeData?.bank_name || 'Branch'}
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '2px' }}>IFSC: {chequeData?.ifsc_code || 'HDFC0000000'}</div>
          <div style={{ 
            border: '2px solid #004c8f', 
            padding: '3px 12px',
            fontSize: '11px',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '2px',
          }}>
            {formatAccountNumber(chequeData?.account_number || '')}
          </div>
          <div style={{ fontSize: '7px', color: '#666', marginTop: '2px', textAlign: 'right' }}>A/C NO.</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px' }}>
        <div style={{ fontSize: '8px', color: '#004c8f', fontWeight: 'bold' }}>
          A/c Payee Only
        </div>
        <div style={{ 
          border: '1px solid #004c8f', 
          padding: '4px 15px',
          minWidth: '160px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '2px' }}>Date</div>
          <div style={{ fontSize: '12px', fontFamily: 'Courier New, monospace', letterSpacing: '1px', fontWeight: 'bold' }}>
            {formatIndianDate(customFields.date)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px', gap: '15px' }}>
        <span style={{ fontSize: '9px', color: '#666', width: '60px', fontWeight: 'bold' }}>Pay</span>
        <div style={{ 
          flex: 1,
          borderBottom: '2px solid #004c8f',
          paddingBottom: '3px',
        }}>
          <div style={{ fontSize: '7px', color: '#999', marginBottom: '2px' }}>Pay to (Name of the Payee)</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#333' }}>
            {customFields.payee_name || '                                                                      '}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px', gap: '15px' }}>
        <span style={{ fontSize: '9px', color: '#666', width: '60px', fontWeight: 'bold' }}>Rupees</span>
        <div style={{ 
          flex: 1,
          borderBottom: '2px solid #004c8f',
          paddingBottom: '3px',
        }}>
          <span style={{ fontSize: '9px', color: '#999' }}>Rs.</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'Courier New, monospace', color: '#004c8f' }}>
            {amount > 0 ? `₹ ${amountStr}` : '                                                                     '}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '6px 20px',
        gap: '15px',
        borderBottom: '2px solid #004c8f',
      }}>
        <span style={{ fontSize: '9px', color: '#666', width: '60px', marginTop: '3px', fontWeight: 'bold' }}>In Words</span>
        <div style={{ flex: 1, minHeight: '35px' }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 'bold', 
            textTransform: 'uppercase',
            lineHeight: '1.4',
            color: '#333',
          }}>
            {customFields.amount_words || '                                                                                         '}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '12px 20px 8px 20px',
      }}>
        <div style={{ fontSize: '8px', color: '#004c8f' }}>
          {customFields.crossed && (
            <div style={{ fontWeight: 'bold' }}>
              <span style={{ textDecoration: 'line-through' }}>    </span> A/c Payee Only
            </div>
          )}
        </div>
        <div style={{ 
          width: '150px',
          borderTop: '1px solid #333',
          paddingTop: '4px',
          fontSize: '8px',
          color: '#666',
          textAlign: 'right',
        }}>
          Authorised Signatory
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '22px',
        backgroundColor: '#004c8f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '7px',
        fontWeight: 'bold',
        letterSpacing: '3px',
      }}>
        MICR BAND
      </div>

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '55px',
        color: 'rgba(0, 76, 143, 0.03)',
        fontWeight: 'bold',
        pointerEvents: 'none',
      }}>
        HDFC BANK
      </div>
    </div>
  );
}

interface IciciChequeProps extends SBIChequeProps {}

function IciciCheque({ chequeData, customFields }: IciciChequeProps) {
  const amount = parseFloat(customFields.amount) || 0;
  const amountStr = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div 
      id="icici-cheque-preview"
      className="icici-cheque"
      style={{
        width: '9in',
        height: '3.85in',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 20px 10px 20px',
        borderBottom: '3px solid #f58220',
        height: '52px',
        background: 'linear-gradient(to right, #fff 0%, #fff8f0 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '55px',
            height: '38px',
            backgroundColor: '#f58220',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '8px',
            fontWeight: 'bold',
          }}>
            ICICI BANK
          </div>
          <div style={{ borderLeft: '2px solid #f58220', paddingLeft: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              ICICI BANK LIMITED
            </div>
            <div style={{ fontSize: '7px', color: '#666' }}>
              {chequeData?.bank_name || 'Branch'}
            </div>
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '2px' }}>IFSC: {chequeData?.ifsc_code || 'ICIC0000000'}</div>
          <div style={{ 
            border: '2px solid #f58220', 
            padding: '4px 10px',
            fontSize: '10px',
            fontFamily: 'Courier New, monospace',
          }}>
            {formatAccountNumber(chequeData?.account_number || '')}
          </div>
          <div style={{ fontSize: '7px', color: '#666', marginTop: '2px' }}>A/C NO.</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', alignItems: 'center' }}>
        <div style={{ fontSize: '9px', color: '#f58220', fontWeight: 'bold' }}>A/c Payee Only</div>
        <div style={{ 
          border: '1px solid #f58220', 
          padding: '5px 12px',
          minWidth: '155px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '7px', color: '#666', marginBottom: '2px' }}>Date</div>
          <div style={{ fontSize: '11px', fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>
            {formatIndianDate(customFields.date)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', gap: '12px' }}>
        <span style={{ fontSize: '9px', color: '#666', width: '55px', fontWeight: 'bold' }}>Pay</span>
        <div style={{ 
          flex: 1,
          borderBottom: '2px solid #f58220',
          paddingBottom: '4px',
        }}>
          <div style={{ fontSize: '7px', color: '#999', marginBottom: '2px' }}>Pay to (Name of the Payee)</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {customFields.payee_name || '                                                                      '}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', gap: '12px' }}>
        <span style={{ fontSize: '9px', color: '#666', width: '55px', fontWeight: 'bold' }}>Rupees</span>
        <div style={{ 
          flex: 1,
          borderBottom: '2px solid #f58220',
          paddingBottom: '4px',
        }}>
          <span style={{ fontSize: '9px', color: '#999' }}>Rs.</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'Courier New, monospace', color: '#f58220' }}>
            {amount > 0 ? `₹ ${amountStr}` : '                                                                     '}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 20px',
        gap: '12px',
        borderBottom: '2px solid #f58220',
      }}>
        <span style={{ fontSize: '9px', color: '#666', width: '55px', marginTop: '3px', fontWeight: 'bold' }}>In Words</span>
        <div style={{ flex: 1, minHeight: '35px' }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 'bold', 
            textTransform: 'uppercase',
            lineHeight: '1.4',
          }}>
            {customFields.amount_words || '                                                                                         '}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '14px 20px 10px 20px',
      }}>
        <div style={{ fontSize: '8px', color: '#f58220', fontWeight: 'bold' }}>
          {customFields.crossed && 'A/c Payee Only'}
        </div>
        <div style={{ 
          width: '145px',
          borderTop: '1px solid #333',
          paddingTop: '5px',
          fontSize: '8px',
          color: '#666',
          textAlign: 'right',
        }}>
          Authorised Signatory
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '20px',
        backgroundColor: '#f58220',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: '7px',
        color: '#fff',
        fontWeight: 'bold',
        letterSpacing: '2px',
      }}>
        <span style={{ flex: 1 }}>CHEQUE NUMBER: {chequeData?.reference || '000000'}</span>
        <span style={{ letterSpacing: '3px' }}>MICR ENCODED</span>
      </div>

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '50px',
        color: 'rgba(245, 130, 32, 0.03)',
        fontWeight: 'bold',
        pointerEvents: 'none',
      }}>
        ICICI BANK
      </div>
    </div>
  );
}

export function ChequePrintClient() {
  const [loading, setLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string>('');
  const [chequeData, setChequeData] = useState<ChequeData | null>(null);
  const [transactionOptions, setTransactionOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [chequeFormat, setChequeFormat] = useState<'SBI' | 'HDFC' | 'ICICI' | 'GENERIC'>('SBI');
  const [customFields, setCustomFields] = useState({
    payee_name: '',
    amount: '',
    date: '',
    amount_words: '',
    account_payee_only: true,
    crossed: true,
  });

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/bank-transactions?limit=9999');
      const transactions = response.data.data || response.data;
      const debitTransactions = (Array.isArray(transactions) ? transactions : [])
        .filter((t: BankTransaction) => t.debit_amount > 0)
        .map((t: BankTransaction) => ({
          label: `${t.party?.name || t.ledger} - ₹${t.debit_amount.toLocaleString()}`,
          value: t.id,
        }));
      setTransactionOptions(debitTransactions);
    } catch {
      toast.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleTransactionSelect = async (transactionId: string) => {
    setSelectedTransaction(transactionId);
    if (!transactionId) {
      setChequeData(null);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`/api/cheques?transaction_id=${transactionId}`);
      const data = response.data.data;
      setChequeData(data);
      
      // Auto-detect bank format
      const bankName = data.bank_name?.toUpperCase() || '';
      if (bankName.includes('SBI') || bankName.includes('STATE BANK')) {
        setChequeFormat('SBI');
      } else if (bankName.includes('HDFC')) {
        setChequeFormat('HDFC');
      } else if (bankName.includes('ICICI')) {
        setChequeFormat('ICICI');
      } else {
        setChequeFormat('SBI'); // Default to SBI format
      }
      
      setCustomFields({
        payee_name: data.party_name,
        amount: data.debit_amount.toString(),
        date: new Date(data.transaction_date).toISOString().split('T')[0],
        amount_words: formatAmountInWords(data.debit_amount),
        account_payee_only: true,
        crossed: true,
      });
    } catch {
      toast.error('Failed to fetch cheque data');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFieldChange = (name: string, value: any) => {
    setCustomFields(prev => ({ ...prev, [name]: value }));
    if (name === 'amount' && value) {
      const numAmount = parseFloat(value);
      if (!isNaN(numAmount)) {
        setCustomFields(prev => ({ ...prev, amount_words: formatAmountInWords(numAmount) }));
      }
    }
  };

  const handlePrint = () => {
    setPrintLoading(true);
    setTimeout(() => {
      window.print();
      setPrintLoading(false);
    }, 500);
  };

  const renderChequePreview = () => {
    const props = { chequeData, customFields };
    switch (chequeFormat) {
      case 'SBI': return <SBICheque {...props} />;
      case 'HDFC': return <HdfcCheque {...props} />;
      case 'ICICI': return <IciciCheque {...props} />;
      default: return <SBICheque {...props} />;
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full">
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Cheque Print
          </h2>
          <p className="text-sm text-muted-foreground">
            Print cheques in Indian Bank formats (SBI, HDFC, ICICI)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Cheque Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Transaction</Label>
              <InlineSelect
                value={selectedTransaction}
                onChange={(value) => handleTransactionSelect(value as string)}
                options={transactionOptions}
                placeholder="Select a payment transaction"
                disabled={loading}
              />
            </div>

            {selectedTransaction && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Cheque Information</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomFields(prev => ({ ...prev, payee_name: '', amount: '', date: '', amount_words: '' }))}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Cheque Format</Label>
                    <div className="flex gap-2">
                      {(['SBI', 'HDFC', 'ICICI'] as const).map((format) => (
                        <Button
                          key={format}
                          variant={chequeFormat === format ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setChequeFormat(format)}
                          className="flex-1"
                        >
                          {format}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Payee Name</Label>
                    <Input
                      value={customFields.payee_name}
                      onChange={(e) => handleCustomFieldChange('payee_name', e.target.value)}
                      placeholder="Enter payee name"
                      className="font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input
                        type="number"
                        value={customFields.amount}
                        onChange={(e) => handleCustomFieldChange('amount', e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="text-lg font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={customFields.date}
                        onChange={(e) => handleCustomFieldChange('date', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount in Words</Label>
                    <Input
                      value={customFields.amount_words}
                      onChange={(e) => handleCustomFieldChange('amount_words', e.target.value)}
                      placeholder="Rupees in words"
                      className="font-medium"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customFields.account_payee_only}
                        onChange={(e) => handleCustomFieldChange('account_payee_only', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium">Account Payee Only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customFields.crossed}
                        onChange={(e) => handleCustomFieldChange('crossed', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium">Crossed</span>
                    </label>
                  </div>
                </div>

                <Button onClick={handlePrint} className="w-full" size="lg" disabled={printLoading}>
                  {printLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Print Cheque
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cheque Preview</span>
              <span className="text-sm font-normal text-muted-foreground">
                {chequeFormat} Format
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-center justify-center bg-gray-100 p-4 rounded-lg overflow-auto"
              style={{ minHeight: '400px' }}
            >
              <div className="cheque-wrapper shadow-lg">
                {renderChequePreview()}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              Preview - Actual print size: 9" x 3.85" (Standard Indian Cheque)
            </p>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .cheque-wrapper,
          .cheque-wrapper * {
            visibility: visible !important;
          }
          .cheque-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 9in !important;
            height: 3.85in !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .sbi-cheque,
          .hdfc-cheque,
          .icici-cheque {
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
        
        .cheque-wrapper {
          transform-origin: top center;
        }
        
        @media (max-width: 1200px) {
          .cheque-wrapper {
            transform: scale(0.85);
          }
        }
        
        @media (max-width: 900px) {
          .cheque-wrapper {
            transform: scale(0.7);
          }
        }
      `}</style>
    </div>
  );
}
