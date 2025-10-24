#!/usr/bin/env node

/**
 * DNS Configuration Checker
 *
 * Утилита для проверки корректности настройки DNS записей (SPF, DKIM, DMARC)
 * для отправки email через MailChannels
 *
 * Использование:
 *   node scripts/check-dns.mjs <domain> [dkim-selector]
 *   node scripts/check-dns.mjs kolibri-dresden.de
 *   node scripts/check-dns.mjs kolibri-dresden.de k1
 *
 * Параметры:
 *   domain - Доменное имя для проверки (обязательный)
 *   dkim-selector - Селектор DKIM (по умолчанию: mailchannels)
 *
 * Проверяет:
 * - SPF: наличие include:relay.mailchannels.net
 * - DKIM: наличие записи для указанного селектора
 * - DMARC: наличие политики
 */

import { promises as dns } from 'dns';

// Цвета для красивого вывода
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[36m',
};

// Функция для цветного вывода
function log(color, message) {
	console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
	log(colors.green, `✅ ${message}`);
}

function logError(message) {
	log(colors.red, `❌ ${message}`);
}

function logWarning(message) {
	log(colors.yellow, `⚠️  ${message}`);
}

function logInfo(message) {
	log(colors.blue, `ℹ️  ${message}`);
}

function logSection(title) {
	console.log('');
	log(colors.bright, '━'.repeat(60));
	log(colors.bright, title);
	log(colors.bright, '━'.repeat(60));
}

/**
 * Получение TXT записей для домена
 */
async function getTxtRecords(domain) {
	try {
		const records = await dns.resolveTxt(domain);
		return records.map((record) => record.join('')); // Flatten массив массивов
	} catch (error) {
		if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
			return null;
		}
		throw error;
	}
}

/**
 * Проверка SPF записи
 */
async function checkSPF(domain) {
	logSection('📋 SPF Record');

	const records = await getTxtRecords(domain);

	if (!records) {
		logError('SPF record not found');
		logInfo('Create a TXT record: v=spf1 include:relay.mailchannels.net ~all');
		return false;
	}

	// Ищем SPF запись
	const spfRecord = records.find((record) => record.startsWith('v=spf1'));

	if (!spfRecord) {
		logError('No SPF record found (v=spf1)');
		logInfo('Create a TXT record: v=spf1 include:relay.mailchannels.net ~all');
		return false;
	}

	logSuccess('SPF record found');
	console.log(`Record: ${spfRecord}`);

	// Проверяем наличие include:relay.mailchannels.net
	if (spfRecord.includes('include:relay.mailchannels.net')) {
		logSuccess('Contains include:relay.mailchannels.net');
		return true;
	} else {
		logError('Missing include:relay.mailchannels.net');
		logInfo('Add "include:relay.mailchannels.net" before ~all or -all');
		return false;
	}
}

/**
 * Проверка DKIM записи
 */
async function checkDKIM(domain, selector = 'mailchannels') {
	logSection(`🔐 DKIM Record (Selector: ${selector})`);

	const dkimDomain = `${selector}._domainkey.${domain}`;
	const records = await getTxtRecords(dkimDomain);

	if (!records) {
		logError(`DKIM record not found: ${dkimDomain}`);
		logInfo('Create a TXT record for:');
		logInfo(`  Name: ${selector}._domainkey.${domain}`);
		logInfo(`  Value: v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>`);
		return false;
	}

	// Ищем DKIM запись
	const dkimRecord = records.find((record) => record.startsWith('v=DKIM1'));

	if (!dkimRecord) {
		logError('Invalid DKIM record format (should start with v=DKIM1)');
		return false;
	}

	logSuccess('DKIM record found');

	// Проверяем наличие публичного ключа
	if (dkimRecord.includes('p=') && dkimRecord.match(/p=[A-Za-z0-9+/=]{100,}/)) {
		logSuccess('Valid DKIM format (v=DKIM1; k=rsa; p=...)');
		// Показываем укороченную версию для читаемости
		const shortRecord = dkimRecord.length > 100 ? dkimRecord.substring(0, 80) + '...' : dkimRecord;
		console.log(`Record: ${shortRecord}`);
		return true;
	} else {
		logError('DKIM record missing public key (p=...)');
		return false;
	}
}

/**
 * Проверка DMARC записи
 */
async function checkDMARC(domain) {
	logSection('🛡️ DMARC Record');

	const dmarcDomain = `_dmarc.${domain}`;
	const records = await getTxtRecords(dmarcDomain);

	if (!records) {
		logWarning(`DMARC record not found: ${dmarcDomain}`);
		logInfo('DMARC is optional but highly recommended!');
		logInfo('Create a TXT record for:');
		logInfo(`  Name: _dmarc.${domain}`);
		logInfo(`  Value: v=DMARC1; p=none; rua=mailto:postmaster@${domain}`);
		return false;
	}

	// Ищем DMARC запись
	const dmarcRecord = records.find((record) => record.startsWith('v=DMARC1'));

	if (!dmarcRecord) {
		logError('Invalid DMARC record format (should start with v=DMARC1)');
		return false;
	}

	logSuccess('DMARC record found');
	logSuccess('Valid DMARC format');

	// Парсим DMARC параметры
	const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/);
	const ruaMatch = dmarcRecord.match(/rua=mailto:([^\s;]+)/);

	if (policyMatch) {
		console.log(`Policy: ${policyMatch[1]}`);
	}

	if (ruaMatch) {
		console.log(`Report email: ${ruaMatch[1]}`);
	}

	console.log(`Record: ${dmarcRecord}`);

	return true;
}

/**
 * Главная функция
 */
async function main() {
	const domain = process.argv[2];
	const selector = process.argv[3] || 'mailchannels'; // DKIM selector (по умолчанию 'mailchannels')

	if (!domain) {
		console.error('Usage: node scripts/check-dns.mjs <domain> [dkim-selector]');
		console.error('Example: node scripts/check-dns.mjs kolibri-dresden.de');
		console.error('Example: node scripts/check-dns.mjs kolibri-dresden.de k1');
		process.exit(1);
	}

	console.log('');
	log(colors.bright, `🔍 Checking DNS records for: ${domain}`);

	try {
		const spfOk = await checkSPF(domain);
		const dkimOk = await checkDKIM(domain, selector);
		const dmarcOk = await checkDMARC(domain);

		// Итоговый результат
		logSection('📊 Summary');

		if (spfOk && dkimOk && dmarcOk) {
			logSuccess('All DNS records are correctly configured!');
			console.log('');
			logInfo('You can now send emails through MailChannels.');
			logInfo(
				'Test email delivery via /api/dev/test-email (see docs/features/email/DEPLOYMENT.md)'
			);
			process.exit(0);
		} else {
			console.log('');
			if (!spfOk) logError('SPF needs attention');
			if (!dkimOk) logError('DKIM needs attention');
			if (!dmarcOk) logWarning('DMARC recommended (optional)');

			console.log('');
			logInfo('See detailed instructions in: docs/features/email/DEPLOYMENT.md');
			process.exit(1);
		}
	} catch (error) {
		console.error('');
		logError(`Error checking DNS: ${error.message}`);
		process.exit(1);
	}
}

// Запуск
main();
