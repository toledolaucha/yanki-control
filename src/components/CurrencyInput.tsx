'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';

interface CurrencyInputProps {
    value?: number;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export function CurrencyInput({
    value,
    onChange,
    placeholder = '0.00',
    className = 'input',
    required = false,
}: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');

    // Update display when external value changes
    useEffect(() => {
        if (value === undefined || value === null) {
            setDisplayValue('');
            return;
        }

        // Only format if the display string equivalent doesn't match the prop value
        // to prevent overwriting while user is typing trailing zeros or decimals
        const numericDisplay = parseFloat(displayValue.replace(/,/g, ''));
        if (numericDisplay !== value || isNaN(numericDisplay)) {
            // Format to standard string with thousand separators
            const parts = value.toString().split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            setDisplayValue(parts.join('.'));
        }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value;

        // Allow only numbers, comma, and dot
        input = input.replace(/[^0-9.,]/g, '');

        // Prevent multiple dots
        const parts = input.split('.');
        if (parts.length > 2) {
            input = parts[0] + '.' + parts.slice(1).join('');
        }

        // Clean commas for numeric parsing
        const rawString = input.replace(/,/g, '');
        const rawNumber = parseFloat(rawString);

        if (input === '' || input === '.') {
            setDisplayValue(input);
            onChange(0);
            return;
        }

        // Format for display
        const displayParts = input.split('.');
        // Remove existing commas to re-format properly
        const wholePart = displayParts[0].replace(/,/g, '');
        // Add thousand separators
        displayParts[0] = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        const formatted = displayParts.join('.');

        setDisplayValue(formatted);

        if (!isNaN(rawNumber)) {
            onChange(rawNumber);
        }
    };

    const handleBlur = () => {
        // Optional formatting polish on blur (like adding .00)
        // Leaving it raw for now to avoid jumpy text
    }

    return (
        <input
            type="text"
            className={className}
            placeholder={placeholder}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            required={required}
            inputMode="decimal"
        />
    );
}
